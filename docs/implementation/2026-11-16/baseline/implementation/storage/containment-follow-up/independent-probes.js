import * as C from '/typing-app/client/src/coach-storage.ts';
import * as S from '/typing-app/client/src/storage.ts';
import { COACH_CONFIG, CONFIG_ID } from '/typing-app/client/src/coach-plan.ts';
import { TypingEngine } from '/typing-app/client/src/engine.ts';
import { assessmentPrompts } from '/typing-app/client/src/corpus.ts';

const NOW = '2026-11-18T12:00:00.000Z';
const native = indexedDB;
const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
const prefix = 'typeforge-c-independent-';
let name, assertions, trace, failures;
const check = (condition, message) => { assertions++; if (!condition) failures.push(message); };
const request = r => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  r.onblocked = () => reject(new Error('Owned synthetic database blocked'));
});
const complete = tx => new Promise((resolve, reject) => {
  tx.oncomplete = resolve; tx.onabort = () => reject(tx.error ?? new Error('Synthetic transaction abort'));
});
async function rawRead(store, key) {
  const db = await request(native.open(name));
  try { const tx = db.transaction(store); const r = tx.objectStore(store).get(key); await complete(tx); return r.result; }
  finally { db.close(); }
}
async function mutate(fn) {
  const db = await request(native.open(name));
  try { const tx = db.transaction(S.SOURCE_STORES, 'readwrite'); fn(tx); await complete(tx); }
  finally { db.close(); }
}
// Producer recipe reused from the C fixture; none of its assertions are replayed.
function assessment(n) {
  const prompts = [...assessmentPrompts]; let state = (1000 + n) >>> 0;
  for (let i = prompts.length - 1; i; i--) { state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    const j = (state >>> 0) % (i + 1); [prompts[i], prompts[j]] = [prompts[j], prompts[i]]; }
  const engine = new TypingEngine({ id: `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`,
    prompts, mode: 'assessment', inputMode: 'flow-v1', durationMs: 30000, qwerty: true, corpusVersion: '1' });
  let now = 0;
  do {
    const position = engine.value.length, text = engine.prompt.text;
    const char = position === text.length ? ' ' : text[position];
    const pair = position > 0 && position < text.length ? text.slice(position - 1, position + 1) : '';
    const dt = pair === 'he' ? 250 : 200;
    if (now + dt >= 30000 && engine.state !== 'idle') break;
    now += dt; engine.edit({ start: position, end: position, text: char, pressTime: now }, now);
  } while (engine.state === 'running');
  engine.tick(30200); return engine.result(NOW);
}
const prepare = () => C.preparePractice({ config: COACH_CONFIG, generation: 7, now: NOW,
  persistence: { state: 'idle', pendingIds: [] }, pendingSources: [] });
const current = () => ({ generation: 7, configId: CONFIG_ID, runState: 'idle' });
async function seedReady() {
  const capture = await C.captureContext();
  check(capture !== null, 'seed obtains real capture');
  for (let n = 1; n <= 10; n++) {
    const saved = await C.saveSource(assessment(n), capture);
    if (saved.state !== 'saved' || !saved.membershipReady) throw new Error('Seed failed');
  }
  return capture;
}
export async function install(databaseName, silent = false) {
  if (location.origin !== 'http://127.0.0.1:5321' || !new RegExp(`^${prefix}[a-f0-9-]+$`).test(databaseName)) throw new Error('Isolation guard');
  name = databaseName; assertions = 0; trace = []; failures = [];
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new Proxy(native, { get(target, key) {
    if (key === 'open') return (requested, version) => {
      if (requested !== 'typeforge') throw new Error('Unexpected production DB name');
      trace.push({ type: 'open', requested, actual: name, version });
      return version === undefined ? target.open(name) : target.open(name, version);
    };
    if (key === 'deleteDatabase') return () => { throw new Error('Refused unguarded cleanup'); };
    const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
  } }) });
  check(indexedDB !== native && trace.length === 0, 'guard installed before any production open');
  if (silent) {
    Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: undefined });
    Storage.prototype.setItem = () => { throw new DOMException('Synthetic denied notification', 'SecurityError'); };
  }
  return { guarded: true, database: name };
}
export async function cleanup() {
  if (descriptor) Object.defineProperty(globalThis, 'indexedDB', descriptor); else delete globalThis.indexedDB;
  if (!name?.startsWith(prefix)) throw new Error('Cleanup guard');
  await request(native.deleteDatabase(name));
  const remaining = (await native.databases()).filter(db => db.name === name);
  return { database: name, remaining, removed: remaining.length === 0 };
}
export async function run(which) {
  const events = [];
  const observer = event => events.push({ message: event.message, error: String(event.error) });
  window.addEventListener('error', observer);
  let details = {};
  try {
    if (which === 'upgrade-add-throw') {
      const original = assessment(1), v2 = native.open(name, 2);
      v2.onupgradeneeded = () => {
        const store = v2.result.createObjectStore(S.STORE, { keyPath: 'id' });
        store.createIndex(S.ORDER_INDEX, ['completedAt', 'id']); store.add(original);
      };
      (await request(v2)).close();
      const old = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add = function (...args) {
        if (this.name === S.METADATA_STORE) throw new DOMException('Independent pre-upgrade add failure', 'QuotaExceededError');
        return old.apply(this, args);
      };
      let rejected;
      try { await S.openDatabase(); } catch (error) { rejected = String(error); }
      finally { IDBObjectStore.prototype.add = old; }
      check(!!rejected, 'failed upgrade rejects open');
      check(events.length === 0, 'failed upgrade contains synchronous add exception without uncaught page error');
      const db = await request(native.open(name));
      details = { rejected, events: [...events], versionAfterFailure: db.version, storesAfterFailure: [...db.objectStoreNames] };
      check(!db.objectStoreNames.contains(S.METADATA_STORE), 'failed upgrade leaves no committed metadata'); db.close();
      check(details.versionAfterFailure === 2 && C.canonicalJSON(await rawRead(S.STORE, original.id)) === C.canonicalJSON(original), 'failed upgrade retains original v2 bytes and version');
      const retry = await C.captureContext();
      check(retry !== null, 'clean retry establishes authority after aborted upgrade');
      check(await rawRead(S.CURRENT_STORE, original.id) === undefined && await rawRead(S.MEMBERSHIP_STORE, original.id) === undefined, 'retry keeps legacy physically legacy without copy/membership');
    } else if (which === 'delete-sync-throw') {
      const capture = await C.captureContext(); const source = assessment(1); await C.saveSource(source, capture);
      const before = await rawRead(S.METADATA_STORE, 'authority');
      const old = IDBObjectStore.prototype.delete;
      IDBObjectStore.prototype.delete = function (...args) {
        if (this.name === S.CURRENT_STORE) throw new DOMException('Independent delete failure', 'UnknownError');
        return old.apply(this, args);
      };
      let rejected; try { await C.deleteSource(source.id); } catch (error) { rejected = String(error); }
      finally { IDBObjectStore.prototype.delete = old; }
      check(!!rejected, 'failed deletion rejects');
      check(events.length === 0, 'failed deletion contains synchronous delete exception without uncaught page error');
      check((await C.getSavedSource(source.id))?.id === source.id, 'failed delete retains source');
      check((await rawRead(S.METADATA_STORE, 'authority')).sourceRevision === before.sourceRevision, 'failed delete retains revision');
      details = { rejected, events: [...events], sourceRetained: true };
    } else if (which === 'mixed-ledger-failed-member') {
      await C.captureContext();
      await mutate(tx => { tx.objectStore(S.STORE).add(assessment(1)); tx.objectStore(S.CURRENT_STORE).add(assessment(2)); });
      const old = IDBObjectStore.prototype.get;
      const physical = [];
      IDBObjectStore.prototype.get = function (...args) {
        physical.push({ store: this.name, key: args[0] });
        if (this.name === S.MEMBERSHIP_STORE) throw new DOMException('Independent synchronous member get failure', 'UnknownError');
        return old.apply(this, args);
      };
      const ledger = C.createPreparationLedger(); let page;
      try { page = await C.listSavedSourcesPage({ cursor: null, ledger }); }
      finally { IDBObjectStore.prototype.get = old; }
      check(page.stop === 'failure' && !page.complete, 'member point failure is incomplete');
      check(ledger.work.examinedRows === physical.length, 'every real attempted point includes failed missing member');
      check(physical.some(p => p.store === S.STORE) && physical.some(p => p.store === S.CURRENT_STORE), 'same ledger charges both streams/collision');
      check(events.length === 0, 'nested synchronous member point failure is contained without uncaught page error');
      const before = physical.length; const again = await C.listSavedSourcesPage({ cursor: page.cursor, ledger });
      check(again.stop === 'failure' && ledger.work.examinedRows === before, 'same terminal ledger does not restart');
      details = { physical, work: ledger.work, stop: page.stop };
    } else if (which === 'missing-meta-no-repair') {
      const capture = await C.captureContext();
      await mutate(tx => tx.objectStore(S.METADATA_STORE).delete('authority'));
      const saved = await C.saveSource(assessment(1), capture);
      check(saved.state === 'saved' && !saved.membershipReady, 'source recovery succeeds without metadata membership');
      check(await rawRead(S.METADATA_STORE, 'authority') === undefined, 'recovery does not bootstrap metadata');
      check(await rawRead(S.MEMBERSHIP_STORE, assessment(1).id) === undefined, 'recovery does not invent membership');
      const status = await prepare();
      check(status.participation.counted === null && status.summary.value === null, 'saved source alone does not prove baseline');
      details = { saved, status };
    } else if (which === 'max-reset-notification') {
      const capture = await C.captureContext();
      await mutate(tx => { const r = tx.objectStore(S.METADATA_STORE).get('authority'); r.onsuccess = () => tx.objectStore(S.METADATA_STORE).put({ ...r.result, sourceRevision: Number.MAX_SAFE_INTEGER - 1 }, 'authority'); });
      const reset = await C.resetEpoch(capture.databaseId);
      check(reset.committed && reset.authority === null && reset.reason === 'authority-exhausted', 'MAX-1 reset distinguishes committed-null from failed');
      check((await rawRead(S.METADATA_STORE, 'authority')).sourceRevision === Number.MAX_SAFE_INTEGER, 'reset commits durable sentinel');
      const saved = await C.saveSource(assessment(1), capture);
      check(saved.state === 'saved' && !saved.membershipReady, 'notification failure at sentinel cannot reverse ordinary durable save');
      check(await C.captureContext() === null, 'MAX cannot recapture');
      details = { reset, saved };
    } else if (which === 'hash-delete-silent') {
      await seedReady();
      const old = SubtleCrypto.prototype.digest; let fired = false;
      SubtleCrypto.prototype.digest = async function (...args) {
        const result = await old.apply(this, args);
        if (!fired) { fired = true; await mutate(tx => {
          tx.objectStore(S.CURRENT_STORE).delete(assessment(1).id);
          tx.objectStore(S.MEMBERSHIP_STORE).delete(assessment(1).id);
          const r = tx.objectStore(S.METADATA_STORE).get('authority');
          r.onsuccess = () => tx.objectStore(S.METADATA_STORE).put({ ...r.result, sourceRevision: r.result.sourceRevision + 1 }, 'authority');
        }); }
        return result;
      };
      let status; try { status = await prepare(); } finally { SubtleCrypto.prototype.digest = old; }
      check(fired, 'mutation occurs during real asynchronous hashing');
      check(status.participation.proof === null && status.summary.value === null && status.coach.snapshot === null, 'hash race publishes no stale proved status/candidate');
      check(!(await C.admitPreparedPractice(status, current)).admitted, 'hash race cannot admit');
      details = { status };
    } else if (which === 'ready-and-local-admission') {
      await seedReady(); const status = await prepare();
      check(status.coach.state === 'complete-ready', 'actual C+D preparation creates ready candidate');
      const proof = status.coach.snapshot?.proof;
      check(proof && proof === status.participation.proof && proof === status.summary.proof, 'all C+D components retain same real proof');
      check(Object.isFrozen(proof) && Object.isFrozen(proof.selection.sourceBindings) && proof.selection.sourceBindings.length === 10, 'complete proof selection immutable');
      const before = status.work.examinedRows;
      for (const update of [{ generation: 8, configId: CONFIG_ID, runState: 'idle' },
        { generation: 7, configId: 'wrong', runState: 'idle' },
        { generation: 7, configId: CONFIG_ID, runState: 'running' },
        { generation: 7, configId: CONFIG_ID, runState: 'disposed' }]) {
        let calls = 0;
        const result = await C.admitPreparedPractice(status, () => (++calls === 1 ? current() : update));
        check(!result.admitted && calls === 2, 'late current identity change cannot admit');
      }
      check(status.work.examinedRows === before + 4, 'each local admission charges same preparation ledger');
      check(!(await C.admitPreparedPractice(structuredClone(status), current)).admitted, 'matching deserialized scalars cannot acquire private preparation');
      const admitted = await C.admitPreparedPractice(status, current);
      check(admitted.admitted && admitted.snapshot.proof === proof, 'successful admission carries actual C proof unchanged');
      globalThis.ownedStatus = status;
      details = { before, work: status.work, proof, admitted: admitted.admitted };
    } else if (which === 'final-proof-abort') {
      await seedReady(); const old = IDBObjectStore.prototype.get; let reads = 0, aborted = false, finalScope;
      IDBObjectStore.prototype.get = function (...args) {
        const r = old.apply(this, args);
        if (this.name === S.METADATA_STORE && ++reads === 2) {
          finalScope = [...this.transaction.objectStoreNames];
          queueMicrotask(() => { aborted = true; this.transaction.abort(); });
        }
        return r;
      };
      let status; try { status = await prepare(); } finally { IDBObjectStore.prototype.get = old; }
      check(aborted && finalScope.length === 4, 'actual second metadata/final overlapping transaction aborted');
      check(status.participation.proof === null && status.summary.value === null && status.coach.snapshot === null, 'aborted final proof publishes no provisional witness/median/focus');
      details = { reads, finalScope, status };
    } else throw new Error(`Unknown probe ${which}`);
  } finally { window.removeEventListener('error', observer); }
  return { which, database: name, assertions, failures, pageErrors: events, details, opens: trace };
}
export async function tabReady() { await seedReady(); globalThis.ownedStatus = await prepare(); return ownedStatus.coach.state; }
export async function peerDelete() { await C.deleteSource(assessment(1).id); return { deleted: true }; }
export async function afterPeer() {
  const before = ownedStatus.work.examinedRows;
  const result = await C.admitPreparedPractice(ownedStatus, current);
  return { admission: result, before, after: ownedStatus.work.examinedRows, frozen: Object.isFrozen(ownedStatus.coach.snapshot) };
}
