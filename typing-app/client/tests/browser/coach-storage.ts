import { openDatabase, saveResult, getResult, listResults, listResultsPage, deleteResult,
  readHistorySlice, scanHistory, validateResult, SOURCE_STORES } from '../../src/storage.ts';
import { captureContext, saveSource, getSavedSource, deleteSource, resetEpoch, createPreparationLedger,
  listSavedSourcesPage, preparePractice, admitPreparedPractice, sourceHash,
  subscribeStorageInvalidation, exportSavedSources } from '../../src/coach-storage.ts';
import { CONFIG_ID, COACH_CONFIG, resolveCertifiedPlan } from '../../src/coach-plan.ts';
import { createFiniteAdapter } from '../../src/finite-practice.ts';
import { TypingEngine, type SessionResult } from '../../src/engine.ts';
import { assessmentPrompts } from '../../src/corpus.ts';
import { selectHistory } from '../../src/profile.ts';
import type { Capture, FinitePracticeResult, Metadata, PracticeSnapshot, SavedSource, MergedCursor, Work } from '../../src/coach-types.ts';

const NOW = '2026-11-18T12:00:00.000Z';
const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
function timed(n: number, mode: 'assessment' | 'practice' = 'assessment'): SessionResult {
  return { id: uuid(n), owner: 'guest', schemaVersion: 1, metricVersion: 1, completedAt: NOW, mode,
    settings: { durationMs: 30000, language: 'en', qwerty: true, corpusVersion: '1', inputMode: 'flow-v1' },
    qualityFlags: [], eligibleForProgress: true,
    metrics: { elapsedMs: 30000, correctCharacters: 0, attemptedCharacters: 1, correctAttempts: 0,
      accuracy: 0, deletedCharacters: 0, wpm: 0 }, sentences: [],
    chartSamples: [{ elapsedMs: 30000, wpm: 0, accuracy: 0 }] };
}
function historical(n: number): SessionResult {
  const source = timed(n);
  source.settings = { durationMs: 60000, language: 'en', qwerty: true, corpusVersion: '1' };
  source.metrics.elapsedMs = 60000; source.chartSamples[0].elapsedMs = 60000;
  return source;
}
function actualAssessment(n: number): SessionResult {
  const prompts = [...assessmentPrompts]; let state = (1000 + n) >>> 0;
  for (let i = prompts.length - 1; i; i--) { state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    const j = (state >>> 0) % (i + 1); [prompts[i], prompts[j]] = [prompts[j], prompts[i]]; }
  const engine = new TypingEngine({ id: uuid(n), prompts, mode: 'assessment', inputMode: 'flow-v1',
    durationMs: 30000, qwerty: true, corpusVersion: '1' });
  let now = 0;
  do {
    const position = engine.value.length, text = engine.prompt.text;
    const char = position === text.length ? ' ' : text[position];
    const pair = position > 0 && position < text.length ? text.slice(position - 1, position + 1) : '';
    const dt = pair === 'he' ? 250 : 200;
    if (now + dt >= 30000 && engine.state !== 'idle') break;
    now += dt; engine.edit({ start: position, end: position, text: char, pressTime: now }, now);
  } while (engine.state === 'running');
  engine.tick(30200);
  return engine.result(NOW)!;
}
function actualFinite(n: number, variant: 'clean' | 'repeat' | 'reverse' = 'clean'): FinitePracticeResult {
  const plan = resolveCertifiedPlan('he')!;
  // Synthetic engine-seam input only; no proof/preparation acceptance is inferred.
  const snapshot = { schemaId: 'typeforge-practice-snapshot-v2', policyId: 'clean-pair-contrast-v1-r2-enabled',
    configId: CONFIG_ID, focus: { pair: 'he' }, plan, actualExposure: null } as PracticeSnapshot;
  const adapter = createFiniteAdapter({ id: uuid(n), snapshot });
  let now = 100;
  for (const [sentence, prompt] of plan.prompts.entries()) {
    if (sentence === 0 && variant === 'reverse') {
      for (const text of [...prompt.text].reverse()) { adapter.edit({ start: 0, end: 0, text, pressTime: now }, now); now += 3; }
      const length = adapter.tick(now).engine.value.length;
      adapter.edit({ start: length, end: length, text: ' ', pressTime: now }, now); now += 3;
      continue;
    }
    for (const [position, text] of [...`${prompt.text} `].entries()) {
      const length = adapter.tick(now).engine.value.length;
      adapter.edit({ start: length, end: length, text, pressTime: now,
        repeat: sentence === 0 && position === 0 && variant === 'repeat' }, now); now += 3;
    }
  }
  return adapter.result(NOW) as FinitePracticeResult;
}

/** Redirect only this fixture realm to unique synthetic DB names. No call can
 * open, upgrade, delete or seed the user's actual `typeforge` database. */
export async function runCoachStorageChecks() {
  if (location.hostname !== '127.0.0.1' || location.port !== '5321') throw new Error('Run only on the owned loopback fixture port5321.');
  const native = globalThis.indexedDB;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  const names: string[] = [];
  let receipt: Record<string, unknown> | undefined;
  let databaseName = '', assertions = 0;
  const checks: string[] = [], work: Work[] = [];
  const mark = (name: string) => { checks.push(name); document.querySelector('#output')!.textContent = JSON.stringify({ running: name, assertions, checks }, null, 2); };
  function assert(value: unknown, message: string): asserts value { assertions++; if (!value) throw new Error(message); }
  function nextDatabase() { databaseName = `typeforge-coach-synthetic-${crypto.randomUUID()}`; names.push(databaseName); }
  const proxy = new Proxy(native, { get(target, property) {
    if (property === 'open') return (name: string, version?: number) => {
      if (name !== 'typeforge') throw new Error('Fixture refused unexpected database name.');
      return version === undefined ? native.open(databaseName) : native.open(databaseName, version);
    };
    if (property === 'deleteDatabase') return () => { throw new Error('Use owned synthetic cleanup only.'); };
    const value = Reflect.get(target, property, target); return typeof value === 'function' ? value.bind(target) : value;
  } });
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: proxy });
  function raw(version?: number, setup?: (database: IDBDatabase, tx: IDBTransaction) => void): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = version === undefined ? indexedDB.open('typeforge') : indexedDB.open('typeforge', version);
      request.onupgradeneeded = () => setup?.(request.result, request.transaction!);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Unexpected fixture blocked connection.'));
    });
  }
  async function seedLegacy(values: unknown[], version = 2) {
    nextDatabase();
    const database = await raw(version, database => {
      const store = database.createObjectStore('results', { keyPath: 'id' });
      if (version === 2) store.createIndex('completedAt-id', ['completedAt', 'id']);
      for (const value of values) store.add(value);
    }); database.close();
  }
  async function mutate(operation: (tx: IDBTransaction) => void) {
    const database = await raw();
    try { await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(SOURCE_STORES, 'readwrite'); operation(tx);
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error('Synthetic transaction aborted.'));
    }); } finally { database.close(); }
  }
  async function value(store: string, key: IDBValidKey): Promise<any> {
    const database = await raw();
    try { return await new Promise((resolve, reject) => {
      const tx = database.transaction(store), pending = tx.objectStore(store).get(key);
      tx.oncomplete = () => resolve(pending.result); tx.onabort = () => reject(tx.error);
    }); } finally { database.close(); }
  }
  const metadata = () => value('coachMetadata', 'authority') as Promise<Metadata>;
  async function revise(tx: IDBTransaction) {
    const request = tx.objectStore('coachMetadata').get('authority');
    request.onsuccess = () => tx.objectStore('coachMetadata').put({ ...request.result, sourceRevision: request.result.sourceRevision + 1 }, 'authority');
  }
  async function allSources() {
    const ledger = createPreparationLedger(); let cursor: MergedCursor | null = null;
    const sources: SavedSource[] = [];
    for (let n = 0; n < 100; n++) {
      const page = await listSavedSourcesPage({ cursor, ledger });
      sources.push(...page.sources.map(read => read.source)); cursor = page.cursor;
      assert(page.work.examinedRows <= 500 && page.work.examinedBytes <= 16 * 1048576, 'shared point/byte caps');
      if (page.complete) return { sources, ledger, cursor };
      assert(page.stop === 'slice', `explicit source retrieval stop: ${page.stop}`);
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    throw new Error('Fixture source traversal failed to terminate.');
  }
  const prepare = (generation = 1) => preparePractice({ config: COACH_CONFIG, generation, now: NOW,
    persistence: { state: 'idle', pendingIds: [] }, pendingSources: [] });
  try {
    for (const version of [1, 2]) {
      await seedLegacy([historical(1)], version);
      const capture = await captureContext(); assert(capture, 'legacy upgrade yields capture');
      const database = await raw(); assert(database.version === 3, 'actual v3 committed');
      assert([...database.objectStoreNames].join() === 'coachMembership,coachMetadata,currentResults,results', 'four physical stores'); database.close();
      assert(await value('results', uuid(1)), 'original legacy source retained');
      assert(await value('currentResults', uuid(1)) === undefined, 'no source bulk copy');
      const state = await metadata(); assert(state.sourceRevision === 0 && state.activeEpochId === state.legacyEpochId, 'atomic initial metadata');
      const page = await allSources(); assert(page.sources.length === 1, 'old timed source remains readable');
      assert((await getResult(uuid(1)))!.settings.inputMode === undefined && (await listResults())[0].metrics.elapsedMs === 60000,
        'historical schema1/60s content remains unchanged through old APIs');
      let versionError = ''; try { (await raw(2)).close(); } catch (error) { versionError = (error as DOMException).name; }
      assert(versionError === 'VersionError', 'old explicit v2 client fails honestly');
      mark(`actual v${version}-to-v3 upgrade and old-client fence`);
    }

    nextDatabase();
    const abort = new AbortController();
    const nativeOpen = native.open.bind(native);
    // Abort a real versionchange before bootstrap can commit; restoration is scoped.
    const aborting = new Proxy(proxy, { get(target, property) {
      if (property !== 'open') return Reflect.get(target, property);
      return (_name: string, version: number) => {
        const request = nativeOpen(databaseName, version);
        request.addEventListener('upgradeneeded', () => abort.abort(new Error('Synthetic upgrade cancellation')));
        return request;
      };
    } });
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: aborting });
    assert(await captureContext(abort.signal) === null, 'aborted upgrade does not capture authority');
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: proxy });
    const recovered = await captureContext(); assert(recovered, 'actual retry after aborted upgrade succeeds');
    assert((await metadata()).sourceRevision === 0, 'aborted bootstrap leaves no mutation');
    mark('actual versionchange abort and retry');

    await seedLegacy([timed(1)]);
    const held = await raw(2);
    assert(await captureContext() === null, 'blocked upgrade returns unavailable');
    held.close();
    // Queue the retry behind the late blocked request. It must abort/close rather
    // than commit metadata after its caller was told the attempt was unavailable.
    const retry = await captureContext(); assert(retry, 'blocked late attempt leaves retry available');
    const live = await openDatabase();
    const later = await raw(4); later.close();
    assert(live.objectStoreNames.contains('results'), 'versionchange closed runtime connection without destroying content');
    mark('actual blocked/late upgrade and connection versionchange');

    nextDatabase(); await captureContext();
    const cancelled = new AbortController(), pendingOpen = openDatabase(cancelled.signal);
    cancelled.abort(new Error('Synthetic cancelled open'));
    let cancelledOpen = false; try { await pendingOpen; } catch { cancelledOpen = true; }
    assert(cancelledOpen, 'cancelled real open rejects before late success');
    const afterLate = await raw(4); afterLate.close();
    mark('actual cancelled open closes its late successful connection');

    nextDatabase();
    const capture = await captureContext(); assert(capture, 'fresh v3 capture');
    assert((await saveSource(timed(1), capture)).state === 'saved', 'captured source commits');
    const initialMember = await value('coachMembership', uuid(1));
    assert(initialMember.epochId === capture.epochId && initialMember.resultSha256 === await sourceHash(timed(1)), 'complete hash/capture membership');
    const firstRevision = (await metadata()).sourceRevision;
    assert((await saveSource(timed(1), capture)).state === 'saved', 'identical source retry');
    assert((await metadata()).sourceRevision === firstRevision, 'identical retry has no invented increment');
    const collision = timed(1); collision.metrics.attemptedCharacters = 2;
    assert((await saveSource(collision, capture)).state === 'failed', 'same-ID different bytes rejected');
    assert((await getSavedSource(uuid(1)))!.metrics.attemptedCharacters === 1, 'collision never overwrites source');
    await mutate(tx => { tx.objectStore('coachMembership').delete(uuid(1)); void revise(tx); });
    const lost = await saveSource(timed(1), capture);
    assert(lost.state === 'saved' && !lost.membershipReady, 'lost membership not silently repaired');
    assert(await value('coachMembership', uuid(1)) === undefined, 'missing membership stays missing');
    const reset = await resetEpoch(capture.databaseId); assert(reset.committed && reset.authority, 'new epoch committed');
    assert((await saveSource(timed(2), capture)).state === 'saved', 'delayed original capture saves after reset');
    assert((await value('coachMembership', uuid(2))).epochId === capture.epochId, 'delayed save retains original old epoch');
    assert((await saveSource(timed(3), null)).state === 'saved', 'uncaptured source ordinary recovery');
    assert(await value('coachMembership', uuid(3)) === undefined, 'uncaptured current never acquires legacy membership');
    const resetStatus = await prepare();
    assert(resetStatus.participation.state === 'not-started', 'old/uncaptured/membership-lost current sources excluded');
    mark('actual save/hash/idempotence/collision/membership loss/reset/delayed recovery');

    const finiteSource = actualFinite(4);
    const currentCapture = await captureContext(); assert(currentCapture, 'capture after reset');
    const finiteSave = await saveSource(finiteSource, currentCapture);
    assert(finiteSave.state === 'saved' && finiteSave.membershipReady, 'actual finite producer source persisted separately');
    assert('schemaId' in (await getSavedSource(uuid(4)))!, 'union read returns finite envelope');
    assert(await getResult(uuid(4)) === undefined, 'old getResult never casts finite');
    const oldList = await listResults(); assert(oldList.length === 3 && oldList.every(source => !('schemaId' in source)), 'old export remains timed-only');
    assert((await listResultsPage()).length === 3, 'old calibration pages remain timed-only');
    assert(selectHistory(oldList, oldList[0].settings).every(sentence => !!sentence), 'legacy calibration API still accepts timed union');
    assert((await allSources()).sources.length === 4, 'new union sees timed and finite once');
    const mixedExport = await exportSavedSources();
    assert(mixedExport.schemaId === 'typeforge-saved-sources-export-v1' && mixedExport.sources.length === 4,
      'separately named mixed export preserves original typed sources');
    assert(JSON.stringify(mixedExport.sources.find(source => source.id === uuid(4))) === JSON.stringify(finiteSource), 'mixed export retains finite content exactly');
    await deleteResult(uuid(4)); assert(await getSavedSource(uuid(4)) === undefined, 'old deletion routes through both stores');
    mark('actual finite source recovery and old timed/calibration/export compatibility');

    for (const faultStore of ['coachMembership', 'coachMetadata']) {
      nextDatabase(); const faultCapture = await captureContext(); assert(faultCapture, 'atomic companion fault setup');
      const oldAdd = IDBObjectStore.prototype.add, oldPut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.add = function (...args: Parameters<IDBObjectStore['add']>) {
        const pending = oldAdd.apply(this, args); if (this.name === faultStore) this.transaction.abort(); return pending;
      };
      IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
        const pending = oldPut.apply(this, args); if (this.name === faultStore) this.transaction.abort(); return pending;
      };
      try { assert((await saveSource(timed(1), faultCapture)).state === 'failed', `actual ${faultStore} write abort reported`); }
      finally { IDBObjectStore.prototype.add = oldAdd; IDBObjectStore.prototype.put = oldPut; }
      assert(await value('currentResults', uuid(1)) === undefined && await value('coachMembership', uuid(1)) === undefined,
        'companion/revision failure rolls back both source and member');
      assert((await metadata()).sourceRevision === 0, 'companion/revision failure rolls back metadata');
      assert((await saveSource(timed(1), faultCapture)).state === 'saved', 'original capture retries after fault');
      mark(`actual atomic ${faultStore} fault and original-capture retry`);
    }

    nextDatabase(); const finiteCapture = await captureContext(); assert(finiteCapture, 'finite recovery capture');
    const oldFiniteAdd = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args: Parameters<IDBObjectStore['add']>) {
      const pending = oldFiniteAdd.apply(this, args); if (this.name === 'coachMembership') this.transaction.abort(); return pending;
    };
    const pendingFinite = actualFinite(1);
    try { assert((await saveSource(pendingFinite, finiteCapture)).state === 'failed', 'finite failure retains retryable original source'); }
    finally { IDBObjectStore.prototype.add = oldFiniteAdd; }
    assert((await resetEpoch(finiteCapture.databaseId)).committed, 'reset between finite failure and retry');
    const recoveredFinite = await saveSource(pendingFinite, finiteCapture);
    assert(recoveredFinite.state === 'saved' && recoveredFinite.membershipReady, 'finite retry reconciles original content');
    assert((await value('coachMembership', uuid(1))).epochId === finiteCapture.epochId, 'finite delayed retry cannot enter new epoch');
    assert((await prepare()).participation.counted === 0, 'finite end never counts as assessment');
    mark('actual finite save failure/reset/retry with original capture');

    nextDatabase(); const finiteGuardCapture = await captureContext(); assert(finiteGuardCapture, 'corrected finite validator capture');
    for (const missing of ['all', 'first'] as const) {
      const bad = actualFinite(missing === 'all' ? 1 : 2, 'repeat');
      const sentence = bad.sentences[0], keys = missing === 'all' ? Object.keys(sentence.keys) : [sentence.promptText[0]];
      for (const key of keys) { bad.metrics.correctAttempts -= sentence.keys[key].correct; delete sentence.keys[key]; }
      bad.metrics.accuracy = bad.metrics.correctAttempts / bad.metrics.attemptedCharacters * 100;
      bad.chartSamples.at(-1)!.accuracy = bad.metrics.accuracy;
      const rejected = await saveSource(bad, finiteGuardCapture);
      assert(rejected.state === 'failed' && !rejected.retryable, 'actual E validator permanently rejects impossible initial-key accounting before save');
      assert(await value('currentResults', bad.id) === undefined, 'rejected finite source was never inserted');
      await mutate(tx => tx.objectStore('currentResults').add(bad));
      let unreadable = false; try { await getSavedSource(bad.id); } catch { unreadable = true; }
      assert(unreadable, 'persisted malformed finite source rejected through actual E read boundary');
    }
    const reverse = actualFinite(3, 'reverse');
    assert((await saveSource(reverse, finiteGuardCapture)).state === 'saved', 'actual reverse-insertion finite source stays valid');
    assert((await allSources()).sources.length === 1 && (await exportSavedSources()).sources.length === 1,
      'mixed history/export includes valid reverse source and retains malformed sources only for recovery');
    assert(await value('currentResults', uuid(1)) !== undefined, 'malformed finite source retained, not silently deleted');
    mark('actual corrected E initial-key rejection and valid reverse-insertion persistence');

    nextDatabase(); await captureContext();
    await mutate(tx => tx.objectStore('coachMetadata').delete('authority'));
    assert(await captureContext() === null, 'missing committed metadata never reboots');
    assert((await saveSource(timed(1), capture)).state === 'saved', 'missing-metadata ordinary recovery commits source');
    assert(await value('coachMembership', uuid(1)) === undefined, 'invalid lineage recovery has no membership');
    assert((await allSources()).sources.length === 1, 'source recovery browse works without metadata');
    assert((await prepare()).participation.counted === null, 'missing metadata has no invented count');
    assert(await value('coachMetadata', 'authority') === undefined, 'source recovery did not silently repair metadata');
    mark('actual missing-metadata source recovery and unavailable policy');

    nextDatabase(); const maxCapture = await captureContext(); assert(maxCapture, 'MAX setup capture');
    await mutate(tx => { const request = tx.objectStore('coachMetadata').get('authority'); request.onsuccess = () =>
      tx.objectStore('coachMetadata').put({ ...request.result, sourceRevision: Number.MAX_SAFE_INTEGER - 1 }, 'authority'); });
    const originalAdd = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args: Parameters<IDBObjectStore['add']>) {
      if (this.name === 'currentResults') { const pending = originalAdd.apply(this, args); this.transaction.abort(); return pending; }
      return originalAdd.apply(this, args);
    };
    try { assert((await saveSource(timed(1), maxCapture)).state === 'failed', 'real atomic source transaction aborted'); }
    finally { IDBObjectStore.prototype.add = originalAdd; }
    assert((await metadata()).sourceRevision === Number.MAX_SAFE_INTEGER - 1, 'abort rolls back revision');
    assert(await value('currentResults', uuid(1)) === undefined && await value('coachMembership', uuid(1)) === undefined, 'abort leaves no partial source/member');
    assert((await saveSource(timed(1), maxCapture)).state === 'saved', 'MAX-1 source commit succeeds');
    assert((await metadata()).sourceRevision === Number.MAX_SAFE_INTEGER, 'source and MAX commit atomically');
    assert(await captureContext() === null, 'MAX disables capture');
    assert((await prepare()).participation.counted === null, 'MAX disables optional authority after reload');
    assert((await saveSource(timed(2), maxCapture)).state === 'saved', 'ordinary save remains available at MAX');
    assert(await value('coachMembership', uuid(2)) === undefined, 'MAX cannot mint membership');
    await deleteSource(uuid(1)); assert((await metadata()).sourceRevision === Number.MAX_SAFE_INTEGER, 'MAX delete retains terminal sentinel');
    const exhaustedReset = await resetEpoch(maxCapture.databaseId);
    assert(!exhaustedReset.committed && exhaustedReset.authority === null, 'reset at MAX cannot create a valid epoch');
    mark('actual MAX-1/MAX source atomicity, rollback, recovery, delete and reset');

    nextDatabase(); const beforeReset = await captureContext(); assert(beforeReset, 'reset MAX-1 capture');
    await mutate(tx => { const request = tx.objectStore('coachMetadata').get('authority'); request.onsuccess = () =>
      tx.objectStore('coachMetadata').put({ ...request.result, sourceRevision: Number.MAX_SAFE_INTEGER - 1 }, 'authority'); });
    const maxReset = await resetEpoch(beforeReset.databaseId);
    assert(maxReset.committed && maxReset.authority === null && maxReset.reason === 'authority-exhausted', 'reset reports committed exhausted outcome');
    assert((await metadata()).sourceRevision === Number.MAX_SAFE_INTEGER, 'reset MAX persists atomically');
    mark('actual committed-but-exhausted epoch reset');

    nextDatabase(); const rollbackCapture = await captureContext(); assert(rollbackCapture, 'reset rollback setup');
    const beforeRollback = await metadata(), oldResetPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      const pending = oldResetPut.apply(this, args); if (this.name === 'coachMetadata') this.transaction.abort(); return pending;
    };
    try { assert(!(await resetEpoch(rollbackCapture.databaseId)).committed, 'aborted reset cannot announce commit'); }
    finally { IDBObjectStore.prototype.put = oldResetPut; }
    assert(JSON.stringify(await metadata()) === JSON.stringify(beforeRollback), 'failed reset preserves epoch and revision');
    await saveSource(timed(1), rollbackCapture);
    await mutate(tx => { const request = tx.objectStore('coachMetadata').get('authority'); request.onsuccess = () =>
      tx.objectStore('coachMetadata').put({ ...request.result, sourceRevision: Number.MAX_SAFE_INTEGER - 1 }, 'authority'); });
    await deleteSource(uuid(1));
    assert((await metadata()).sourceRevision === Number.MAX_SAFE_INTEGER && await value('currentResults', uuid(1)) === undefined,
      'MAX-1 delete and sentinel commit together');
    mark('actual reset rollback and MAX-1 delete atomicity');

    // Real merged index traversal with invalid native Date/binary/array keys.
    await seedLegacy([timed(1), timed(3), { id: uuid(7), completedAt: 7 },
      { id: uuid(8), completedAt: 'zzz' }, { id: uuid(9), completedAt: [NOW] }, { id: uuid(10) }]);
    await captureContext();
    await saveResult(timed(2)); await saveResult(timed(4));
    const merged = await allSources(); assert(merged.sources.map(source => source.id).join() === [4, 3, 2, 1].map(uuid).join(), 'native newest-first merge with corrupt keys');
    assert(merged.ledger.work.unindexableLegacy === 1 && merged.ledger.work.unindexableCurrent === 0, 'nullable separate unindexable counts become actual values');
    assert(merged.ledger.work.countRequests === 4 && merged.ledger.work.keyRequests <= 2 * merged.ledger.work.examinedRows + 4, 'count/key request bounds');
    const history = await scanHistory(); assert(history.complete && history.results.length === 4, 'old bounded history sees both physical partitions');
    assert((await listResultsPage({ completedAt: NOW, id: uuid(3) }, 1))[0].id === uuid(2), 'old exclusive global cursor continuity');
    mark('actual partition merge, corrupt native keys and timed cursor continuity');

    const oneRaw = await readHistorySlice({ rowLimit: 1 });
    assert(oneRaw.results.length === 0 && oneRaw.cursor !== null, 'corrupt raw key still advances timed cursor');
    const retainedRaw = structuredClone(oneRaw.cursor!);
    assert(indexedDB.cmp(retainedRaw, oneRaw.cursor!) === 0, 'native raw cursor survives structured clone');
    const continuation = await readHistorySlice({ before: retainedRaw, rowLimit: 1 });
    assert(continuation.cursor !== null && indexedDB.cmp(continuation.cursor, retainedRaw) < 0, 'native corrupt continuation is exclusive');
    await mutate(tx => { tx.objectStore('currentResults').put(timed(1)); void revise(tx); });
    let collisionRejected = false; try { await getSavedSource(uuid(1)); } catch { collisionRejected = true; }
    assert(collisionRejected, 'cross-partition duplicate is integrity failure');
    assert(!(await listResults()).some(source => source.id === uuid(1)), 'timed export excludes both conflicting physical copies');
    assert((await prepare()).participation.counted === 0, 'collision cannot supply a witness');
    mark('actual corrupt-key continuation and cross-partition collision');

    for (const partition of ['results', 'currentResults']) {
      nextDatabase(); await captureContext();
      await mutate(tx => { tx.objectStore(partition).add({ id: uuid(9), completedAt: '9999-01-01T00:00:00.000Z', bad: 'x'.repeat(2 * 1048576) });
        tx.objectStore(partition === 'results' ? 'currentResults' : 'results').add(timed(1)); });
      const ledger = createPreparationLedger(); const page = await listSavedSourcesPage({ cursor: null, ledger });
      assert(page.stop === 'record-limit' && !page.complete, `terminal oversized ${partition}`);
      assert(ledger.terminal === 'record-limit' && ledger.work.oversizedSerializedBytes === null && ledger.work.oversizedByteLowerBound === 1048577, 'actual source prefix charge and unknown exact total');
      assert(ledger.work.examinedRows === 2, 'record-limit stops before other stream or companion');
      assert(page.cursor[partition === 'results' ? 'legacy' : 'current'].before !== null, 'excluded oversized raw key retained');
      const again = await listSavedSourcesPage({ cursor: page.cursor, ledger });
      assert(again.stop === 'record-limit' && ledger.work.examinedRows === 2, 'no automatic fresh-cap continuation');
      mark(`actual terminal oversized source in ${partition}`);
    }

    nextDatabase(); const memberCapture = await captureContext(); assert(memberCapture, 'companion setup capture');
    await saveSource(timed(1), memberCapture);
    await mutate(tx => tx.objectStore('coachMembership').put({ resultId: uuid(1), bad: 'x'.repeat(8192) }));
    const memberLedger = createPreparationLedger();
    const memberPage = await listSavedSourcesPage({ cursor: null, ledger: memberLedger });
    assert(memberPage.stop === 'record-limit' && memberLedger.work.oversizedByteLowerBound === 4097, 'terminal bounded compact membership');
    assert(memberLedger.work.examinedRows === 4, 'metadata/source/missing cross-partition/member each charged');
    await mutate(tx => tx.objectStore('coachMetadata').put({ bad: 'x'.repeat(8192) }, 'authority'));
    const metaLedger = createPreparationLedger();
    assert((await listSavedSourcesPage({ cursor: null, ledger: metaLedger })).stop === 'record-limit', 'terminal oversized metadata');
    assert(metaLedger.work.examinedRows === 1 && metaLedger.work.examinedBytes === 4096, 'metadata terminal consumes exactly one compact prefix');
    mark('actual membership and metadata terminal record-limit');

    for (const attempts of [498, 499, 500]) {
      nextDatabase(); await captureContext();
      const ledger = createPreparationLedger();
      while (ledger.work.examinedRows < attempts) {
        // Synthetic point prefill tests the same ledger's exact edge; physical
        // metadata/final source request execution below is separately asserted.
        if (ledger.reserve('source', 0)) ledger.settle(0, null);
        else {
          // An empty real slice resets cooperative limits without replacing the ledger.
          // A normal empty database page supplies the actual slice transition.
          const page = await listSavedSourcesPage({ cursor: null, ledger });
          assert(page.stop === 'exhausted', 'empty page resets only the cooperative slice');
        }
      }
      // The regular edge cases are exercised below using real records; prefill
      // counters are source-level budget probes and are not extra browser rows.
      assert(ledger.work.examinedRows === attempts, 'same lookup reaches the exact 499/500 edge');
      if (attempts === 500) {
        assert(!ledger.reserve('metadata', 4096) && ledger.terminal === 'row-budget', '501st point attempt is refused');
        const page = await listSavedSourcesPage({ cursor: null, ledger });
        assert(page.stop === 'row-budget' && ledger.work.examinedRows === 500, 'terminal total allowance is never refreshed');
      }
    }
    mark('source-level ledger edge probes in a real browser realm');

    const prefix = Array.from({ length: 166 }, (_, index) => {
      const source = timed(index + 1);
      if (index < 156) { source.qualityFlags = ['invalid-input']; source.eligibleForProgress = false; }
      return source;
    });
    await seedLegacy(prefix); await captureContext();
    const capped = await prepare(); work.push(capped.work);
    assert(capped.participation.state === 'complete' && capped.summary.state === 'available', 'independent ten/newest-ten proof survives incomplete recent window');
    assert(capped.coach.state === 'pending' && capped.evidenceScanComplete === false, 'bounded unfinished recent range is pending, not no-effect');
    assert(capped.work.examinedRows <= 500 && capped.work.examinedRows >= 490, 'source, missing companions and actual final proof share the 500 cap');
    mark('actual near-cap source/companion prefix and reserved final proof');

    const boundarySources = Array.from({ length: 30 }, (_, index) => timed(index + 1, index < 20 ? 'practice' : 'assessment'));
    await seedLegacy(boundarySources); await captureContext();
    const boundary = await prepare();
    assert(boundary.participation.state === 'complete' && boundary.summary.state === 'available'
      && boundary.coach.state === 'complete-insufficient', 'component ranges accept real page over-read');
    if (boundary.participation.state === 'complete') {
      const selection = boundary.participation.proof.selection;
      assert(selection.summaryRange.complete && selection.summaryRange.stop === 'tenth-assessment'
        && selection.summaryRange.orderedSourceIds.length === 10, 'summary freezes exact tenth boundary');
      assert(selection.coachRange?.complete && selection.coachRange.stop === 'twentieth-run'
        && selection.coachRange.orderedSourceIds.length === 20, 'coach freezes exact twentieth boundary');
      assert(selection.sourceBindings.length > 20 && boundary.work.examinedRows === 2 + selection.sourceBindings.length * 3,
        'every over-read source/companion remains bound and charged');
    }
    const older = Array.from({ length: 10 }, (_, index) => ({ ...timed(index + 1), completedAt: '2026-09-01T12:00:00.000Z' }));
    await seedLegacy([...older, ...Array.from({ length: 10 }, (_, index) => timed(index + 1001))]); await captureContext();
    const cutoffBoundary = await prepare();
    assert(cutoffBoundary.participation.state === 'complete', 'cutoff-boundary baseline remains complete');
    if (cutoffBoundary.participation.state === 'complete') {
      const selection = cutoffBoundary.participation.proof.selection;
      assert(selection.coachRange?.complete && selection.coachRange.stop === 'older-than-cutoff'
        && selection.coachRange.orderedSourceIds.length === 11, 'first actual old canonical row proves age boundary');
      assert(selection.sourceBindings.length > 11, 'charged over-read past age boundary is retained');
    }
    mark('actual C+D component prefix over-read and full proof selection binding');

    const big = timed(1); big.qualityFlags = ['invalid-input']; big.eligibleForProgress = false;
    const pairs = Object.fromEntries(Array.from({ length: 60 }, (_, index) => [
      String.fromCharCode(97 + Math.floor(index / 26), 97 + index % 26), { count: 1, logSum: Math.log(200) },
    ]));
    big.sentences = Array.from({ length: 200 }, () => ({ promptId: 'large-synthetic', promptText: 'a'.repeat(300), response: 'a'.repeat(300),
      submitted: true, eligible: true, diagnosticsAvailable: true, qualityFlags: [],
      keys: { a: { attempts: 1, correct: 1, firstAttempts: 1, firstErrors: 0 } }, pairs }));
    validateResult(big);
    await seedLegacy(Array.from({ length: 30 }, (_, index) => ({ ...big, id: uuid(index + 1) }))); await captureContext();
    const byteBounded = await prepare(); work.push(byteBounded.work);
    assert(byteBounded.participation.state === 'pending' && byteBounded.summary.state === 'pending', 'near-byte-cap traversal cannot claim exact incomplete total');
    assert(byteBounded.work.examinedBytes <= 16 * 1048576 && byteBounded.work.examinedBytes > 12 * 1048576
      && byteBounded.work.examinedRows < 500, 'actual byte prefixes and final proof share the16-MiB cap');
    mark('actual near-byte-cap disjoint sources/companions and reserved final proof');

    async function seedReady(extra = 0) {
      nextDatabase(); const captured = await captureContext(); assert(captured, 'real evidence capture');
      for (let n = 1; n <= 10; n++) assert((await saveSource(actualAssessment(n), captured)).state === 'saved', 'real source setup');
      if (extra) await mutate(tx => {
        for (let n = 11; n <= extra + 10; n++) {
          const source = timed(n); source.completedAt = '2026-11-18T11:00:00.000Z';
          source.qualityFlags = ['invalid-input']; source.eligibleForProgress = false;
          tx.objectStore('currentResults').add(source);
        }
        void revise(tx);
      });
      return captured;
    }
    // 165 complete source triples + initial metadata + final proof =497.
    // Repeated idle admission checks then execute actual points499/500, while
    // the next attempt is refused before issuing an IDB request under that ledger.
    await seedReady(155);
    const edgeReady = await prepare();
    assert(edgeReady.coach.state === 'complete-ready' && edgeReady.work.examinedRows === 497, 'near-cap real candidate retains final proof allowance');
    const edgeGet = IDBObjectStore.prototype.get; let admissionRequests = 0;
    IDBObjectStore.prototype.get = function (...args: Parameters<IDBObjectStore['get']>) {
      if (this.name === 'coachMetadata') admissionRequests++;
      return edgeGet.apply(this, args);
    };
    try {
      for (let n = 0; n < 3; n++) assert((await admitPreparedPractice(edgeReady, () => ({ generation: 1, configId: CONFIG_ID, runState: 'idle' }))).admitted,
        'reserved real admission point fits remaining same ledger');
      assert(!(await admitPreparedPractice(edgeReady, () => ({ generation: 1, configId: CONFIG_ID, runState: 'idle' }))).admitted,
        '501st preparation/admission point refuses rather than refreshing budget');
      assert(admissionRequests === 3, 'refused501st point issues no physical request');
    } finally { IDBObjectStore.prototype.get = edgeGet; }
    mark('actual final admission points498/499/500 and refused501st request');

    for (const change of ['insert', 'delete', 'reset'] as const) {
      await seedReady();
      const digest = SubtleCrypto.prototype.digest; let changed = false;
      SubtleCrypto.prototype.digest = async function (...args: Parameters<SubtleCrypto['digest']>) {
        const result = await digest.apply(this, args);
        if (!changed) {
          changed = true;
          await mutate(tx => {
            if (change === 'insert') tx.objectStore('currentResults').add(timed(11));
            if (change === 'delete') { tx.objectStore('currentResults').delete(uuid(10)); tx.objectStore('coachMembership').delete(uuid(10)); }
            const request = tx.objectStore('coachMetadata').get('authority');
            request.onsuccess = () => tx.objectStore('coachMetadata').put({ ...request.result,
              ...(change === 'reset' ? { activeEpochId: crypto.randomUUID() } : {}), sourceRevision: request.result.sourceRevision + 1 }, 'authority');
          });
        }
        return result;
      };
      try {
        const raced = await prepare();
        assert(changed && (change === 'reset' ? raced.participation.state === 'unavailable' && raced.participation.counted === null
          : raced.participation.state === 'pending' && raced.participation.counted === 0),
          `actual unnotified ${change} during source hashing cannot manufacture current proof`);
      } finally { SubtleCrypto.prototype.digest = digest; }
      mark(`actual ${change} during hashing with missed notifications`);
    }

    for (const change of ['insert', 'delete', 'reset'] as const) {
      await seedReady();
      const peer = await raw();
      const transaction = IDBDatabase.prototype.transaction, digest = SubtleCrypto.prototype.digest;
      let hashes = 0, injected = false;
      SubtleCrypto.prototype.digest = async function (...args: Parameters<SubtleCrypto['digest']>) {
        const result = await digest.apply(this, args); hashes++; return result;
      };
      IDBDatabase.prototype.transaction = function (...args: Parameters<IDBDatabase['transaction']>) {
        if (!injected && hashes === 10 && args[1] === 'readonly') {
          injected = true;
          // Queue the actual overlapping writer FIRST. The final readonly barrier
          // must observe its commit rather than compare a cached revision scalar.
          const writer = transaction.call(peer, SOURCE_STORES, 'readwrite');
          if (change === 'insert') writer.objectStore('currentResults').add(timed(11));
          if (change === 'delete') { writer.objectStore('currentResults').delete(uuid(10)); writer.objectStore('coachMembership').delete(uuid(10)); }
          const request = writer.objectStore('coachMetadata').get('authority');
          request.onsuccess = () => writer.objectStore('coachMetadata').put({ ...request.result,
            ...(change === 'reset' ? { activeEpochId: crypto.randomUUID() } : {}), sourceRevision: request.result.sourceRevision + 1 }, 'authority');
        }
        return transaction.apply(this, args);
      };
      try {
        const raced = await prepare();
        assert(injected && (change === 'reset' ? raced.participation.state === 'unavailable' && raced.participation.counted === null
          : raced.participation.state === 'pending' && raced.participation.counted === 0),
          `actual ${change} queued before final barrier prevents stale proof`);
      } finally { IDBDatabase.prototype.transaction = transaction; SubtleCrypto.prototype.digest = digest; peer.close(); }
      mark(`actual overlapping ${change} before final readonly barrier`);
    }

    await seedReady();
    const faultGet = IDBObjectStore.prototype.get; let metaReads = 0;
    IDBObjectStore.prototype.get = function (...args: Parameters<IDBObjectStore['get']>) {
      const pending = faultGet.apply(this, args);
      if (this.name === 'coachMetadata' && ++metaReads === 2) pending.addEventListener('success', () => this.transaction.abort());
      return pending;
    };
    try {
      const failedProof = await prepare();
      assert(metaReads === 2 && failedProof.participation.state === 'pending' && failedProof.participation.counted === 0,
        'actual final metadata transaction abort never mints proof');
      assert(failedProof.work.examinedRows === 32, 'failed final point remains charged');
    } finally { IDBObjectStore.prototype.get = faultGet; }
    mark('actual final proof request abort and charged failure');

    for (const faultStore of ['currentResults', 'coachMembership'] as const) {
      await seedReady();
      const originalGet = IDBObjectStore.prototype.get; let injected = false;
      IDBObjectStore.prototype.get = function (...args: Parameters<IDBObjectStore['get']>) {
        if (!injected && this.name === faultStore) { injected = true; throw new DOMException('Synthetic request failure', 'UnknownError'); }
        return originalGet.apply(this, args);
      };
      try {
        const failed = await prepare();
        assert(injected && failed.participation.state === 'pending' && failed.participation.counted === 0, 'failed point does not mint completeness');
        assert(failed.work.examinedRows === (faultStore === 'currentResults' ? 2 : 4), 'failed source/member attempt is charged even with no payload settlement');
      } finally { IDBObjectStore.prototype.get = originalGet; }
      mark(`actual transaction with injected ${faultStore} point failure`);
    }

    for (const corruption of ['missing', 'MAX', 'oversized'] as const) {
      await seedReady();
      const digest = SubtleCrypto.prototype.digest; let hashes = 0;
      SubtleCrypto.prototype.digest = async function (...args: Parameters<SubtleCrypto['digest']>) {
        const result = await digest.apply(this, args);
        if (++hashes === 10) await mutate(tx => {
          const store = tx.objectStore('coachMetadata');
          if (corruption === 'missing') store.delete('authority');
          else if (corruption === 'oversized') store.put({ bad: 'x'.repeat(8192) }, 'authority');
          else { const pending = store.get('authority'); pending.onsuccess = () => store.put({ ...pending.result, sourceRevision: Number.MAX_SAFE_INTEGER }, 'authority'); }
        });
        return result;
      };
      try {
        const failed = await prepare();
        assert(failed.participation.proof === null && failed.summary.state !== 'available', 'no proof survives invalid final metadata');
        if (corruption !== 'oversized') assert(failed.participation.state === 'unavailable' && failed.participation.counted === null,
          'missing/MAX final authority is unavailable, not a provisional lower bound');
        else assert(failed.work.oversizedSerializedBytes === null && failed.work.oversizedByteLowerBound === 4097
          && failed.work.examinedRows === 32, 'oversized final metadata consumes one terminal compact prefix in the same ledger');
      } finally { SubtleCrypto.prototype.digest = digest; }
      mark(`actual ${corruption} metadata at final proof`);
    }

    for (const kind of ['date', 'binary', 'cycle'] as const) {
      nextDatabase(); await captureContext();
      const bad: any = { id: uuid(9), completedAt: kind === 'date' ? new Date(NOW) : kind === 'binary' ? new Uint8Array([5]) : 'zzz' };
      if (kind === 'cycle') bad.self = bad;
      await mutate(tx => { tx.objectStore('results').add(bad); tx.objectStore('currentResults').add(timed(1)); });
      const ledger = createPreparationLedger(), page = await listSavedSourcesPage({ cursor: null, ledger });
      assert(page.stop === 'record-limit' && !page.complete && page.cursor.legacy.before !== null, 'unsupported/cyclic source is terminal and keeps native key');
      const retained = structuredClone(page.cursor);
      assert(indexedDB.cmp(retained.legacy.before!, page.cursor.legacy.before!) === 0, 'Date/binary/cyclic raw cursor remains native through cloning');
      const beforeRows = ledger.work.examinedRows;
      assert((await listSavedSourcesPage({ cursor: retained, ledger })).stop === 'record-limit' && ledger.work.examinedRows === beforeRows,
        'unsupported source never restarts in another partition/slice');
      const explicit = await listSavedSourcesPage({ cursor: retained, ledger: createPreparationLedger() });
      assert(explicit.complete && explicit.sources.length + page.sources.length === 1,
        'explicit new lookup preserves source exactly once on either side of native corrupt key');
      mark(`actual ${kind} record-limit and explicit raw continuation`);
    }

    await seedReady();
    const sliceTimeout = window.setTimeout.bind(window); let sliceChanged = false;
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      if (!sliceChanged && timeout === 0 && typeof handler === 'function') {
        sliceChanged = true;
        return sliceTimeout(() => { void mutate(tx => {
          tx.objectStore('currentResults').delete(uuid(10)); tx.objectStore('coachMembership').delete(uuid(10)); void revise(tx);
        }).then(() => handler(...args)); }, 0);
      }
      return sliceTimeout(handler, timeout, ...args);
    }) as typeof window.setTimeout;
    try {
      const sliced = await prepare();
      assert(sliceChanged && sliced.participation.state === 'pending' && sliced.participation.counted === 0,
        'actual deletion between cooperative slices prevents stale witness lower bound');
    } finally { window.setTimeout = sliceTimeout; }
    mark('actual source deletion between cooperative slices');

    nextDatabase(); const rollbackClock = await captureContext(); assert(rollbackClock, 'clock rollback capture');
    await saveSource({ ...timed(1), completedAt: '2000-01-01T00:00:00.000Z' }, rollbackClock);
    await saveSource({ ...timed(2), completedAt: '2000-01-01T00:00:00.000Z' }, null);
    const clockStatus = await prepare();
    assert(clockStatus.participation.counted === 1, 'physical current membership controls clock-rollback sources, never legacy cutoff alone');
    const recreatedName = databaseName, oldIdentity = rollbackClock.databaseId;
    await new Promise<void>((resolve, reject) => { const request = native.deleteDatabase(recreatedName); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
    const recreated = await captureContext(); assert(recreated && recreated.databaseId !== oldIdentity, 'actual synthetic database recreation changes identity');
    assert((await saveSource(timed(3), rollbackClock)).state === 'saved' && await value('coachMembership', uuid(3)) === undefined,
      'old database capture cannot acquire new lineage after recreation');
    assert(!(await resetEpoch(oldIdentity)).committed, 'old database identity cannot reset recreated authority');
    mark('actual clock rollback and synthetic database recreation lineage');

    nextDatabase(); const purposeCapture = await captureContext(); assert(purposeCapture, 'protected-purpose capture setup');
    const protectedSave = await saveSource(timed(1), { ...purposeCapture, purpose: 'protected-probe' });
    assert(protectedSave.state === 'saved' && protectedSave.membershipReady, 'exact protected capture persists its original purpose');
    const recaptureAttempt = await saveSource(timed(1), purposeCapture);
    assert(recaptureAttempt.state === 'saved' && !recaptureAttempt.membershipReady
      && (await value('coachMembership', uuid(1))).purpose === 'protected-probe', 'same source cannot silently recapture with another purpose');
    assert((await prepare()).participation.counted === 0, 'protected source is never an ordinary assessment witness');
    mark('actual exact capture-purpose retry reconciliation');

    nextDatabase(); const readyCapture = await captureContext(); assert(readyCapture, 'ready setup capture');
    for (let n = 1; n <= 10; n++) assert((await saveSource(actualAssessment(n), readyCapture)).state === 'saved', 'real-engine assessment saved');
    const ready = await prepare(); work.push(ready.work);
    assert(ready.participation.state === 'complete' && ready.summary.state === 'available', 'actual final proof authorizes independent milestone and newest summary');
    assert(ready.coach.state === 'complete-ready', `real D/E preparation ready: ${ready.coach.state}`);
    assert(ready.work.examinedRows === 32, `metadata + ten source/collision/member triples + final proof: ${ready.work.examinedRows}`);
    if (ready.coach.state === 'complete-ready') {
      const proof = ready.coach.snapshot.proof;
      assert(proof === ready.participation.proof && proof === ready.summary.proof, 'same actual storage proof propagated into every component');
      assert(Object.isFrozen(proof) && Object.isFrozen(proof.selection.sourceBindings) && Object.isFrozen(ready.coach.snapshot), 'actual prepared proof and snapshot immutable');
    }
    const admission = await admitPreparedPractice(ready, () => ({ generation: 1, configId: CONFIG_ID, runState: 'idle' }));
    assert(admission.admitted, 'same-ledger final local admission succeeds');
    assert(!(await admitPreparedPractice(structuredClone(ready), () => ({ generation: 1, configId: CONFIG_ID, runState: 'idle' }))).admitted,
      'deserialized scalar-identical historical proof/status is never admitted');
    const changedConfig = await admitPreparedPractice(await prepare(), () => ({ generation: 1, configId: '0'.repeat(64), runState: 'idle' }));
    assert(!changedConfig.admitted, 'changed config cannot admit');
    const changedGeneration = await admitPreparedPractice(await prepare(), () => ({ generation: 2, configId: CONFIG_ID, runState: 'idle' }));
    assert(!changedGeneration.admitted, 'changed generation cannot admit');
    const started = await admitPreparedPractice(await prepare(), () => ({ generation: 1, configId: CONFIG_ID, runState: 'running' }));
    assert(!started.admitted && started.reason === 'started', 'first insertion/started state rejects late prepared result');
    let notified = 0; const unsubscribe = subscribeStorageInvalidation(() => { notified++; });
    const focusReady = await prepare(); window.dispatchEvent(new Event('focus'));
    assert(!(await admitPreparedPractice(focusReady, () => ({ generation: 1, configId: CONFIG_ID, runState: 'idle' }))).admitted, 'missed-notification focus discards preparation');
    const pageReady = await prepare(); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    assert(!(await admitPreparedPractice(pageReady, () => ({ generation: 1, configId: CONFIG_ID, runState: 'idle' }))).admitted, 'BFCache pageshow discards preparation');
    unsubscribe(); assert(notified >= 2, 'invalidation subscribers notified without focus stealing');
    const deleted = await prepare(); await deleteSource(uuid(1));
    assert(!(await admitPreparedPractice(deleted, () => ({ generation: 1, configId: CONFIG_ID, runState: 'idle' }))).admitted, 'local deletion invalidates idle preparation');
    assert((await prepare()).participation.counted === 9, 'deletion removes witness and median');
    assert(admission.admitted && admission.snapshot.sources.length === 10, 'already admitted historical snapshot unchanged by deletion');
    mark('actual real D/E final proof, immutable selection, local admission and invalidation');

    const result = { passed: true, assertions, checks, work, databaseNames: names,
      scope: 'actual Chromium IndexedDB synthetic databases; no production app migration or UI/AT acceptance' };
    receipt = result;
    document.querySelector('#output')!.textContent = JSON.stringify(result, null, 2);
    return result;
  } catch (error) {
    const failure = { passed: false, assertions, checks, error: error instanceof Error ? error.stack : String(error), work, databaseNames: names };
    receipt = failure;
    document.querySelector('#output')!.textContent = JSON.stringify(failure, null, 2); return failure;
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'indexedDB', descriptor); else Reflect.deleteProperty(globalThis, 'indexedDB');
    for (const name of names) {
      if (!name.startsWith('typeforge-coach-synthetic-')) throw new Error('Cleanup path is not owned.');
      await new Promise<void>(resolve => { const request = native.deleteDatabase(name); request.onsuccess = () => resolve(); request.onerror = () => resolve(); request.onblocked = () => resolve(); });
    }
    const remaining = (await native.databases()).map(database => database.name).filter(name => names.includes(name!));
    if (receipt) { receipt.cleanup = { attempted: names.length, remaining };
      if (remaining.length) { receipt.passed = false; receipt.cleanupError = 'Owned synthetic database cleanup incomplete.'; } }
  }
}

/** C1 author regressions. Window/external page errors are observed, never suppressed. */
export async function runStorageContainmentCheck(which: 'upgrade' | 'delete' | 'membership') {
  const name = `typeforge-coach-tab-synthetic-${crypto.randomUUID()}`;
  const { native, descriptor } = tabDatabase(name);
  const errors: string[] = [], unhandled: string[] = [], failures: string[] = [];
  let assertions = 0;
  const check = (condition: unknown, message: string) => { assertions++; if (!condition) failures.push(message); };
  const observe = (event: ErrorEvent) => { errors.push(String(event.error ?? event.message)); };
  const observeUnhandled = (event: PromiseRejectionEvent) => { unhandled.push(String(event.reason)); };
  window.addEventListener('error', observe); window.addEventListener('unhandledrejection', observeUnhandled);
  const request = <T>(pending: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
    pending.onsuccess = () => resolve(pending.result); pending.onerror = () => reject(pending.error);
  });
  const complete = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error('Synthetic transaction aborted.'));
  });
  async function read(store: string, key: IDBValidKey): Promise<any> {
    const database = await request(native.open(name));
    try { const tx = database.transaction(store), pending = tx.objectStore(store).get(key);
      await complete(tx); return pending.result;
    } finally { database.close(); }
  }
  let details: Record<string, unknown> = {}, harnessError: string | undefined;
  try {
    if (which === 'upgrade') {
      const source = actualAssessment(1), pending = native.open(name, 2);
      pending.onupgradeneeded = () => {
        const store = pending.result.createObjectStore('results', { keyPath: 'id' });
        store.createIndex('completedAt-id', ['completedAt', 'id']); store.add(source);
      };
      (await request(pending)).close();
      const add = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add = function (...args: Parameters<IDBObjectStore['add']>) {
        if (this.name === 'coachMetadata') throw new DOMException('C1 synchronous bootstrap add', 'QuotaExceededError');
        return add.apply(this, args);
      };
      let rejection: unknown;
      try { (await openDatabase()).close(); } catch (error) { rejection = error; }
      finally { IDBObjectStore.prototype.add = add; }
      check(!!rejection, 'bootstrap fault rejects open');
      const preserved = await request(native.open(name));
      check(preserved.version === 2, 'failed bootstrap preserves v2 version');
      check([...preserved.objectStoreNames].join() === 'results', 'failed bootstrap leaves no partial stores/metadata');
      preserved.close();
      check(await sourceHash(await read('results', source.id)) === await sourceHash(source), 'failed bootstrap preserves complete legacy source');
      const capture = await captureContext(); check(!!capture, 'clean upgrade retry captures authority');
      check((await read('coachMetadata', 'authority')).sourceRevision === 0, 'clean upgrade retry starts revision zero');
      check(await read('currentResults', source.id) === undefined && await read('coachMembership', source.id) === undefined,
        'retry never copies/reassigns legacy source');
      details = { rejection: String(rejection), versionAfterFailure: 2 };
    } else if (which === 'delete') {
      const source = actualAssessment(1), capture = await captureContext();
      const saved = await saveSource(source, capture); check(saved.state === 'saved', 'delete setup durably saves source');
      const before = await read('coachMetadata', 'authority'), originalMember = await read('coachMembership', source.id);
      const remove = IDBObjectStore.prototype.delete;
      IDBObjectStore.prototype.delete = function (...args: Parameters<IDBObjectStore['delete']>) {
        if (this.name === 'currentResults') throw new DOMException('C1 synchronous current delete', 'UnknownError');
        return remove.apply(this, args);
      };
      let rejection: unknown;
      try { await deleteSource(source.id); } catch (error) { rejection = error; }
      finally { IDBObjectStore.prototype.delete = remove; }
      check(!!rejection, 'delete fault rejects');
      check(await sourceHash((await getSavedSource(source.id))!) === await sourceHash(source), 'failed delete preserves source bytes');
      check(JSON.stringify(await read('coachMetadata', 'authority')) === JSON.stringify(before), 'failed delete preserves full authority/revision');
      check(JSON.stringify(await read('coachMembership', source.id)) === JSON.stringify(originalMember), 'failed delete preserves membership');
      await deleteSource(source.id);
      check(await getSavedSource(source.id) === undefined && await read('coachMembership', source.id) === undefined, 'clean delete retry removes source/member');
      check((await read('coachMetadata', 'authority')).sourceRevision === before.sourceRevision + 1, 'clean delete retry advances revision once');
      check((await saveSource(actualAssessment(2), capture)).state === 'saved', 'ordinary save remains usable after failed delete/retry');
      details = { rejection: String(rejection), revisionBefore: before.sourceRevision };
    } else {
      check(!!await captureContext(), 'membership setup has real metadata');
      const database = await request(native.open(name));
      try { const tx = database.transaction(SOURCE_STORES, 'readwrite');
        tx.objectStore('results').add(actualAssessment(1)); tx.objectStore('currentResults').add(actualAssessment(2)); await complete(tx);
      } finally { database.close(); }
      const get = IDBObjectStore.prototype.get, physical: string[] = [];
      IDBObjectStore.prototype.get = function (...args: Parameters<IDBObjectStore['get']>) {
        physical.push(this.name);
        if (this.name === 'coachMembership') throw new DOMException('C1 synchronous nested membership get', 'UnknownError');
        return get.apply(this, args);
      };
      const ledger = createPreparationLedger(); let page;
      try { page = await listSavedSourcesPage({ cursor: null, ledger }); }
      finally { IDBObjectStore.prototype.get = get; }
      check(!page.complete && page.stop === 'failure' && ledger.terminal === 'failure', 'nested get failure is terminal and incomplete');
      check(physical.join() === 'coachMetadata,currentResults,results,coachMembership', 'real point attempts include current/missing legacy/failed member');
      check(ledger.work.examinedRows === 4 && ledger.work.examinedRows === physical.length, 'each attempted point is charged once');
      const rows = ledger.work.examinedRows, bytes = ledger.work.examinedBytes;
      const again = await listSavedSourcesPage({ cursor: page.cursor, ledger });
      check(again.stop === 'failure' && ledger.work.examinedRows === rows && ledger.work.examinedBytes === bytes,
        'terminal same-ledger retry issues no point and no fresh allowance');
      const explicit = await listSavedSourcesPage({ cursor: null, ledger: createPreparationLedger() });
      check(explicit.complete && explicit.sources.length === 2, 'explicit new lookup works after fault removal');
      check(await read('coachMembership', uuid(2)) === undefined, 'failed read/retry never repairs missing membership');
      details = { physical, work: { ...ledger.work }, retryWork: explicit.work };
    }
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    check(errors.length === 0, 'callback exception never escapes as a window/page error');
    check(unhandled.length === 0, 'failed operation has no unhandled promise rejection');
  } catch (error) { harnessError = error instanceof Error ? error.stack : String(error); }
  finally {
    window.removeEventListener('error', observe); window.removeEventListener('unhandledrejection', observeUnhandled);
    if (descriptor) Object.defineProperty(globalThis, 'indexedDB', descriptor); else Reflect.deleteProperty(globalThis, 'indexedDB');
    await request(native.deleteDatabase(name));
  }
  const remaining = (await native.databases()).filter(database => database.name === name);
  return { which, assertions, failures, errors, unhandled, harnessError, details,
    cleanup: { database: name, remaining }, passed: !harnessError && failures.length === 0 && remaining.length === 0 };
}

let tabState: { native: IDBFactory; descriptor?: PropertyDescriptor; broadcastDescriptor?: PropertyDescriptor;
  name: string; ready: Awaited<ReturnType<typeof preparePractice>>; notifications: number; storageEvents: number;
  broadcastEvents: number; monitor: BroadcastChannel | null;
  unsubscribe: () => void; observer: (event: StorageEvent) => void } | null = null;

/** Accepted P3 assertions, unchanged apart from the root-transferred v3 open
 * helper. This realm-local factory keeps even its seed/clear operations isolated. */
export async function runAcceptedHistoryChecks() {
  const name = `typeforge-coach-tab-synthetic-${crypto.randomUUID()}`;
  const { native, descriptor } = tabDatabase(name);
  const result: { passed: boolean; database: string; history: unknown; byteRepair: unknown; failures: string[]; cleanup?: unknown } = {
    passed: false, database: name, history: null, byteRepair: null, failures: [],
  };
  try {
    const module = await import('./bounded-history.ts');
    try { result.history = await module.runHistoryChecks(); }
    catch (error) { result.failures.push(error instanceof Error ? error.stack! : String(error)); }
    try { const bytes = await module.runHistoryByteRepairChecks(); result.byteRepair = bytes;
      if (!bytes.passed) result.failures.push(...bytes.failures);
    } catch (error) { result.failures.push(error instanceof Error ? error.stack! : String(error)); }
    result.passed = result.failures.length === 0;
    return result;
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'indexedDB', descriptor); else Reflect.deleteProperty(globalThis, 'indexedDB');
    await new Promise<void>((resolve, reject) => { const request = native.deleteDatabase(name);
      request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); request.onblocked = () => reject(new Error('Owned P3 fixture cleanup blocked.')); });
    const remaining = (await native.databases()).filter(database => database.name === name);
    result.cleanup = { remaining };
    if (remaining.length) result.passed = false;
  }
}

function tabDatabase(name: string) {
  if (location.hostname !== '127.0.0.1' || location.port !== '5321'
    || !/^typeforge-coach-tab-synthetic-[a-f0-9-]+$/.test(name)) throw new Error('Synthetic tab fixture isolation required.');
  const native = indexedDB, descriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new Proxy(native, { get(target, key) {
    if (key === 'open') return (requested: string, version?: number) => {
      if (requested !== 'typeforge') throw new Error('Refused non-fixture database.');
      return version === undefined ? native.open(name) : native.open(name, version);
    };
    const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
  } }) });
  return { native, descriptor };
}

/** Run on primary tab, then pass returned peerUrl to a second real Orca tab. */
export async function startCoachTabFixture() {
  if (tabState) throw new Error('Finish the owned tab fixture before starting another.');
  const name = `typeforge-coach-tab-synthetic-${crypto.randomUUID()}`;
  const { native, descriptor } = tabDatabase(name);
  const broadcastDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'BroadcastChannel');
  const fallback = new URL(location.href).searchParams.has('fallback');
  if (fallback) Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: undefined });
  const capture = await captureContext(); if (!capture) throw new Error('Tab capture failed.');
  for (let n = 1; n <= 10; n++) if ((await saveSource(actualAssessment(n), capture)).state !== 'saved') throw new Error('Tab seed failed.');
  const ready = await preparePractice({ config: COACH_CONFIG, generation: 1, now: NOW,
    persistence: { state: 'idle', pendingIds: [] }, pendingSources: [] });
  if (ready.coach.state !== 'complete-ready') throw new Error('Tab fixture requires actual admitted-candidate preparation.');
  const state = { native, descriptor, broadcastDescriptor, name, ready, notifications: 0, storageEvents: 0,
    broadcastEvents: 0, monitor: null as BroadcastChannel | null,
    unsubscribe: () => {}, observer: (_event: StorageEvent) => {} };
  state.unsubscribe = subscribeStorageInvalidation(() => { state.notifications++; });
  state.observer = event => { if (event.key === 'typeforge-source-invalidation-v3') state.storageEvents++; };
  if (!fallback) { state.monitor = new BroadcastChannel('typeforge-source-invalidation-v3');
    state.monitor.onmessage = () => { state.broadcastEvents++; }; }
  window.addEventListener('storage', state.observer); tabState = state;
  return { name, preparedRevision: ready.coach.snapshot.proof.authority.revision,
    peerUrl: `${location.origin}/tests/browser/coach-storage.html?db=${name}${fallback ? '&fallback=1' : ''}`, fallback };
}

/** Run on a separate tab at peerUrl; its production save uses the real fence. */
export async function mutateCoachTabFixture() {
  const name = new URL(location.href).searchParams.get('db') ?? '';
  const { descriptor } = tabDatabase(name);
  const broadcastDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'BroadcastChannel');
  if (new URL(location.href).searchParams.has('fallback')) Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: undefined });
  try {
    const capture = await captureContext(); if (!capture) throw new Error('Peer capture unavailable.');
    const saved = await saveSource(timed(999), capture);
    if (saved.state !== 'saved' || !saved.membershipReady) throw new Error('Peer atomic save failed.');
    return { saved: true, id: uuid(999), database: name, fallback: new URL(location.href).searchParams.has('fallback') };
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'indexedDB', descriptor); else Reflect.deleteProperty(globalThis, 'indexedDB');
    if (broadcastDescriptor) Object.defineProperty(globalThis, 'BroadcastChannel', broadcastDescriptor); else Reflect.deleteProperty(globalThis, 'BroadcastChannel');
  }
}

/** Run on primary after the peer settles; removes only its synthetic database. */
export async function finishCoachTabFixture() {
  const state = tabState; if (!state) throw new Error('No owned tab fixture.');
  try {
    const admission = await admitPreparedPractice(state.ready, () => ({ generation: 1, configId: CONFIG_ID, runState: 'idle' }));
    const union = await exportSavedSources();
    const passed = !admission.admitted && union.sources.length === 11 && state.storageEvents > 0 && state.notifications > 0
      && (!state.monitor || state.broadcastEvents > 0);
    return { passed, admission, sourceCount: union.sources.length, storageEvents: state.storageEvents,
      notifications: state.notifications, broadcastEvents: state.broadcastEvents, database: state.name, actualSeparateTab: true };
  } finally {
    state.unsubscribe(); window.removeEventListener('storage', state.observer);
    state.monitor?.close();
    if (state.descriptor) Object.defineProperty(globalThis, 'indexedDB', state.descriptor); else Reflect.deleteProperty(globalThis, 'indexedDB');
    if (state.broadcastDescriptor) Object.defineProperty(globalThis, 'BroadcastChannel', state.broadcastDescriptor); else Reflect.deleteProperty(globalThis, 'BroadcastChannel');
    await new Promise<void>((resolve, reject) => { const request = state.native.deleteDatabase(state.name);
      request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); request.onblocked = () => reject(new Error('Owned tab fixture database still blocked.')); });
    tabState = null;
  }
}
