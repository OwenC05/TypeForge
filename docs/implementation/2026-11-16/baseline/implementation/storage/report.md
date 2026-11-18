# C storage implementation

Worker task task_7cae09d835e7, dispatch ctx_34bb6b024b5b. Integration owner is root; this lane owns storage modules and synthetic storage fixtures, with no UI edits or real user database migration.

## Work and acceptance sequence

1. Atomic v3 upgrade and current-source capture/save/retry/delete/reset, with durable MAX sentinel and original legacy store retained.
2. Native merged source/history retrieval, bounded JSON-prefix acquisition and separately typed finite validation.
3. One preparation ledger covering source/collision/membership/metadata attempts, including failed/missing requests and reserved proof/admission reads; terminal record-limit across both streams and companions.
4. Actual overlapping final transaction, immutable compact binding and post-proof D projection; current local identity and same-ledger authority check immediately before admission.
5. Real browser fixture execution against a new isolated loopback origin/database, then full Node/typecheck/build and explicit app/UX handoff limits.

## Dependencies and integration obligations

- Root froze coach-types.ts at14b2a43 and amended ProjectionInput.work atad964ed; C supplies actual ledger counters.
- D plan/config/certificate dependency db4af5eb41953c1589a2cd18c856eb147bd18fdf imported asbb11184. Finite-source resolver grants exact shipped content identity only.
- E engine/finite source dependency fb2781b53e0d5b77c7df1a5d2106a48ecdeca50f imported as39fb667. Distinct finite validation is never applied through the timed validator.
- D policy337bd4f8b2fef4ab1119df0a7dde9b8da5a00ba4, final policy/tests f77be72ddbaa25f7321b003b719ba3dd50cd0898, and shared provisional classifier5d1951ff02ddb6586e0872bc28c5f28165dab0a0 are imported. C uses D's actual classifier and frozen projection/admission exports; no duplicate policy predicate remains.
- E follow-ups f88e3134d690c6bbb05fb81bd6e045265d4f7860 and corrected initial-key validator8378937f39c3bbdfcf476c80b558af4ffd38b44f are imported. Root separately reported independent finite reacceptance be6d1d5d0d11561801ecbda3833c3eec0492caf0; C's browser checks additionally execute the actual corrected validator at save/read/export boundaries.
- Root confirmed additive C exports createPreparationLedger/invalidatePreparations/subscribeStorageInvalidation/admitPreparedPractice. F must replace the existing unsaved existence shortcut with full source/hash/membership reconciliation and retain original capture; root audits the complete integrated writer fence.

## Checkpoint evidence

`node --experimental-strip-types --test typing-app/client/tests/storage.test.ts typing-app/client/tests/history.test.ts typing-app/client/tests/coach-storage.test.ts`:26/26 pass. These are Node validator/ledger/prefix/failure cleanup checks, not real IndexedDB execution. Final preparation and browser acceptance remain open.

## Implemented boundaries

- Atomic upgrade preserves `results` physically and adds `currentResults`, `coachMembership`, and one out-of-line `coachMetadata/authority` record. No source enumeration/copy is used for upgrade. Explicit old v2 opens fail after v3; blocked/cancelled attempts close or abort late connections.
- Every shipped C save/delete/reset overlaps all four stores and advances the durable revision for relevant committed changes. Exact retries compare complete canonical content and original membership; missing/different membership is never repaired. MAX-1 commits its change plus MAX atomically; MAX retains ordinary source recovery/deletion/export without capture or admission. Invalid/missing metadata remains invalid/missing. Runtime-validator loading failure is never misclassified as malformed metadata and used to bypass a valid revision fence.
- Timed save/recovery uses the unchanged public timed validator. Bounded timed acquisition uses its unchanged structural body after accepted prefix measurement, without a second whole-record serialization. Finite sources use only E's distinct validator and D's exact stored-plan resolver, outside live transactions.
- Both source indexes merge using `indexedDB.cmp` and native structured-cloned cursors. Every selected source, opposite-partition collision check and membership point is charged, including missing/failed points. Counts remain nullable until actual success. The ledger enforces25 attempts/4MiB per acquisition slice and500/16MiB overall, at most four count requests and bounded key-only requests. It reserves both final proof and admission allowance before consuming another source batch. Source or compact-companion record-limit is terminal for the same lookup.
- C freezes validated values and hashes outside transactions, completes the actual final overlapping metadata transaction, creates one immutable compact proof, then calls real D projection. A second reserved read in the same ledger checks authority before admission; D receives the same actual proof. A deserialized status cannot acquire the private preparation entry. Generation/config/run-state checks use a callback read after asynchronous work. Local/cross-tab/focus/pageshow invalidation discards idle preparation; an admitted historical snapshot remains immutable.
- Only `all-writer-revision` is implemented. No coherent fallback or historical proof is manufactured. Its release validity depends on root's integrated closed writer inventory; arbitrary devtools/extension/raw writes without revision are outside that method, as specified by lifecycle-r2.

## Actual execution

Node24.21.0; installed TypeScript7.0.2 and Vite8.3.3. `npm run check` in `typing-app/client` passes **205/205 tests**, typecheck and production build; see `full-check.txt`. There is no configured lint script and no dependency or lint-tool addition. Existing Node storage/history tests remain unchanged and pass; eight new storage tests cover canonical hashing, reservations/settlement, terminal stops, prefix measurement and unavailable paths.

`window.runCoachStorageChecks()` on the owned Orca Chromium tab at `http://127.0.0.1:5321/tests/browser/coach-storage.html` passes **435 assertions**; `browser-main.json` records named checks, actual work and cleanup of all45 synthetic databases. This is real IndexedDB execution with scoped fault/race injection, not a fake IndexedDB implementation. The explicitly labelled direct ledger-prefill probes are source-level allowance assertions performed in a browser realm; they are not claimed as additional physical source reads. Separate real near-cap preparation/admission tests physically execute points498/499/500 and prove that the next attempt issues no IDB request.

Real browser coverage includes fresh/v1/v2 upgrade, versionchange abort/retry/block/late success, historical schema1/60s content, current/legacy save and collisions, exact capture-purpose retries, membership loss, reset around delayed timed/finite saves, source/member/revision rollback, missing metadata and ordinary recovery, MAX transitions/rollback/reset/delete, clock rollback and synthetic recreation, raw Date/binary/array cursor continuity, cyclic/oversized sources and compact companions, per-partition unindexable counts, row/byte/final-proof limits, over-read beyond tenth/twentieth/age component boundaries, final proof abort/missing/MAX/oversize, injected failed points, insert/delete/reset during hashing and queued before the final readonly barrier, deletion between slices, immutable selection/proof identity, deserialized-proof refusal and final generation/config/started checks. Corrected E finite failures, valid reverse insertion, finite failure/reset/retry, timed calibration/export and mixed-source recovery/export execute against the real D/E modules.

Two separate real Orca tabs share only a unique synthetic database for each test. `browser-tabs-broadcast.json` records one actual BroadcastChannel event plus one storage event and denied stale admission after the peer's fenced save; `browser-tabs-fallback.json` records BroadcastChannel disabled in both realms, one storage event, and the same denied stale admission. Both see11 original sources after the peer save and remove their owned synthetic DB. No actual `typeforge` database is opened or migrated: the fixture's realm-local factory redirects that exact name to a UUID-named synthetic DB, and guarded native cleanup targets only those owned names.

Operation durations are observations under normal concurrent machine load, not a controlled benchmark. Native cloning/request latency and the synchronous post-proof policy projection can overshoot8ms; `maxOperationMs` exposes these overruns. The accepted caps bound avoidable prefix acquisition and request work, not absolute latency, memory or frame responsiveness. No disk-quota/OS-crash, Firefox/Safari, real user-data, production deployment or UI/AT acceptance is claimed.

## Integration exports and remaining acceptance

All frozen C exports remain in `src/coach-storage.ts`: captureContext, saveSource, getSavedSource, listSavedSourcesPage, deleteSource, resetEpoch, readPolicySlice and preparePractice. Additive helpers are:

```ts
createPreparationLedger(limits?: { rowLimit?: number; byteLimit?: number }): Ledger;
invalidatePreparations(): void;
subscribeStorageInvalidation(listener: () => void): () => void;
admitPreparedPractice(status: PreparedStatus, current: () => {
  generation: number; configId: string; runState: 'idle' | 'running' | 'disposed';
}): Promise<Admission>;
exportSavedSources(): Promise<{
  schemaId: 'typeforge-saved-sources-export-v1'; sources: SavedSource[];
}>;
```

`sourceHash` and `canonicalJSON` expose the same complete canonical content identity for recovery/testing. Existing timed APIs retain their old return types and see valid timed sources in both partitions; a finite envelope is never cast to SessionResult. Mixed export has its own named envelope and contains original sources only, without authority metadata. Explicit full exports are separate user requests, not spare automatic policy budgets.

F/root must still wire original capture before insertion, pendingSources across rapid Again/navigation/failure, full source/hash/membership retry reconciliation in `unsaved.ts` (replace the existing source-existence shortcut), current generation/config/run-state callbacks at admission, invalidation subscription/disposal, reset result unions, finite labels/recovery/export, truthful independent component UI states and immediate General/manual. No automatic fresh-cap retry may follow an incomplete lookup. Root rechecks the integrated writer inventory and independent technical/actual-Claude acceptance; native AT, human understanding, High Contrast/device checks and real app behavior remain separate. No C author probe self-approves the feature.

The existing `tests/browser/bounded-history.ts` still explicitly opens v2 in its seed/count helper. After a v3 read this cannot replay unchanged; root is being asked for that exact fixture lease to use production `openDatabase()` instead of its hard-coded v2 bootstrap. No existing browser fixture has been edited without transfer.
