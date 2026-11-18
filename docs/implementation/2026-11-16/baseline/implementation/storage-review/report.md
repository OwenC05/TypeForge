**REVISE — C storage/proof implementation at `2832ceef907a02ca7a9487bfe7eb6b398218d911`.** One P2 error-containment finding has three concrete reproductions. The tested failures abort or abstain truthfully and preserve durable state; no stale proof admission or data loss was observed. Root remains integration owner; this verdict does not cover F's app/unsaved integration or the separate D numeric review.

18 November 2026. Task `task_be8a0fa27cf1`, dispatch `ctx_2915f7119931`, terminal `term_375bd675-235f-4566-993d-459d2c064cc4`, isolated child `tf-coach-storage-review`. Brief HEAD is `4e990c344f243455bccea923f6c04d1b3383f2e6`; its difference from the source pin is six documentation/brief/receipt files, with no client source difference. Only this new review directory is committed. No production, existing test, type, package, config, corpus, user-data or prior-evidence edit was made.

**Ranked finding C1, P2: synchronous exceptions escape asynchronous IDB callbacks as uncaught page errors.**

| Site at the source pin | Minimal independent reproduction and observed result |
| --- | --- |
| `typing-app/client/src/storage.ts:236–250`, particularly `metadata.add` at247 | Install the guarded adapter before any production open; seed a unique synthetic v2 DB with one real engine result; override native `IDBObjectStore.prototype.add` only for `coachMetadata` to throw a `QuotaExceededError`; call actual `openDatabase()`. The promise rejects with upgrade `AbortError`, but both the page error listener and external Playwright `pageerror` observe the uncaught original exception. Native inspection retains version2 and byte-identical canonical legacy source; no metadata commits. Removing the fault permits v3 retry, without copying legacy into current/membership. This independently reproduces F's supplied observation. |
| `typing-app/client/src/coach-storage.ts:252–255`, delete callback before its narrower metadata-put catch | Save an actual source through C; override `delete` only for `currentResults` to throw `UnknownError`; call actual `deleteSource(id)`. It rejects with abort, preserves the source and revision, but emits an uncaught page error. The earlier queued legacy delete is rolled back. |
| `typing-app/client/src/coach-storage.ts:368,446–449`, nested point-ready callback | Seed both synthetic source stores; override `get` only for `coachMembership` to throw `UnknownError`; call actual `listSavedSourcesPage` with one real ledger. The nested point reserves and charges the failed attempt and makes the ledger terminal `failure`, but the throw escapes `ready(value)` after the original outer try has returned. The operation returns incomplete and cannot restart under that ledger, while also emitting an uncaught page error. |

These are narrowly injected synchronous API failures in otherwise real native transactions, not observed disk-quota exhaustion or simulated IDB implementations. Their shared defect is callback exception containment, not revision/atomicity failure. The save callback already contains its synchronous work; the upgrade, delete, and asynchronous nested-point callback paths do not contain all of theirs. The failing assertions intentionally remain failing. Root received the evidence early as `msg_8efefbe3cae1`; no production patch or new architecture is proposed in this lane. Acceptance of a bounded correction should retain rejection/incomplete reporting and rollback while eliminating uncaught page errors at these exact sites.

**Independent execution and provenance.**

`results.json` contains **63 independently authored assertions across10 selected scenarios:60 pass,3 fail**, using10 fresh isolated Chromium contexts and12 actual pages. Every selected scenario has a unique guarded `typeforge-c-independent-*` database, verified cleanup and no harness error. The final upgrade case is a narrowly strengthened v2 rerun replacing that one earlier fresh-DB case, not another counted suite. Exploratory repeats and two corrected harness mistakes are preserved in `harness-notes.txt` and `initial-probe-results.json`; none inflate the63. The shared actual-engine assessment generator recipe is reused openly from C's fixture; its assertions and1024 author checks are not replayed or counted here.

| Independent scenario | Assertions | Evidence |
| --- | ---: | --- |
| v2 upgrade `metadata.add` synchronous fault, preservation and clean retry | 7, one failure | Original native v2 source/version preserved; no partial authority or bulk copy; uncaught upgrade exception. |
| Delete synchronous fault and rollback | 5, one failure | Failed promise, source retained, prior revision retained; uncaught delete exception. |
| Both partitions, missing collision and failed membership under one ledger | 6, one failure | Four physical attempted gets = metadata + current source + missing legacy counterpart + failed member; all four charged; same ledger cannot restart; uncaught nested exception. |
| Missing metadata, ordinary recovery and no silent repair | 5 | Save succeeds with membershipReady=false, metadata/member remain missing, baseline count stays null and no median exists. |
| MAX-1 reset, MAX recovery and denied notifications | 5 | Reset commits epoch+MAX with authority=null/authority-exhausted; ordinary save remains durable without membership despite notification failure; capture remains unavailable. |
| Revision mutation during actual asynchronous source hashing, with no invalidation signal | 5 | A synthetic four-store fenced deletion+revision transaction occurs from the digest hook; final real revision proof detects it, outputs pending zero/no median/no candidate and refuses admission. This hook uses the contracted transaction/revision relation; actual production peer deletion is exercised separately below. |
| Actual C→D ready proof, immutable complete selection, late local state changes | 12 | Real ten-source candidate; one identical proof object across participation/summary/candidate/admission; frozen ten bindings; post-barrier generation/config/running/disposed changes reject; four checks add four same-ledger rows; deserialized status rejects; valid idle admission succeeds with the original proof. |
| Actual final overlapping transaction abort | 4 | Abort the second metadata get after seeding, specifically the final metadata barrier; all four stores recorded. No provisional count, median or focus is published; count is pending zero. |
| Two actual pages, normal channels and production peer deletion | 7 | Stale admission rejects before another point read; storage event observed; broadcast counter includes earlier seed messages and is not a count of peer writes; snapshot stays frozen. |
| Two actual pages, both notification channels disabled and production peer deletion | 7 | Zero broadcast/storage/local invalidations; admission performs the reserved second metadata read, advancing the same ledger from32 to33, and rejects the changed revision; snapshot stays frozen. |

The request count in the failed-membership case is intercepted at native `IDBObjectStore.get`, not produced by ledger prefill. The ready case has32 charged points before admission and37 after four denied local-state checks plus one successful admission. The silent two-page case proves the second durable check matters even with no notification; equal cached scalars or status deserialization cannot substitute for a storage operation. Existing direct `reserve/settle` unit tests remain unit evidence and are not counted as physical requests. Native durations in the receipts are observations, not latency or heap guarantees.

**Question1: migration, origin, writer closure and terminal revision.**

Source inspection: `storage.ts:224–264` upgrades atomically to v3, retains legacy `results`, ensures its existing compound index, adds current/member/metadata stores and exactly one out-of-line authority entry. No source enumeration or copying occurs in upgrade. `onversionchange` closes production connections; blocked or aborted opens reject, late success closes, and late `upgradeneeded` aborts rather than continuing a cancelled attempt. The explicit v3 open means an explicit old v2 open fails after successful upgrade. Those blocked/late/old-bundle paths were source-reviewed here; C's supplied browser cases cover runtime examples, which were not independently replayed.

The current C bundle's complete direct source-writer inventory is small:

| Production entry | Actual mutation boundary |
| --- | --- |
| `storage.ts:saveResult`, ordinary app/legacy unsaved save | Delegates to `saveSource(result,null)` after existing timed validation; it cannot grant captured membership. |
| `coach-storage.ts:saveSource` | Readstate outside hashing, then readwrite `SOURCE_STORES` = results/currentResults/coachMembership/coachMetadata; re-read source/member/meta, compare canonical stored bytes, add only current/member and advance valid metadata revision atomically. |
| `storage.ts:deleteResult` / `coach-storage.ts:deleteSource` | Same four-store readwrite scope; delete both possible source locations and membership; advance revision if source or orphan member changed. |
| `coach-storage.ts:resetEpoch` | Same overlapping readwrite scope; change only active epoch and revision. No source/member clear or copy. |
| `storage.ts:openDatabase` upgrade | Exclusive versionchange bootstrap; only this creates authority. |

The repository source search found no other shipped direct IDB writer, import, repair or overwrite path. Preferences use separate non-evidence state. Final F app/unsaved call-site inventory is root's later integration obligation; its known exists-only shortcut is neither a new C finding nor accepted here. Arbitrary devtools/extension mutations that omit the revision are explicitly outside the accepted all-writer contract. Synthetic corrupt-state setup in probes is not represented as a shipped writer.

`saveSource`, deletion and reset use bounded validated metadata. Missing/malformed metadata is never replaced; ordinary recovery/deletion may continue without policy authority. Valid revision increments saturate at MAX; MAX-1 mutation+MAX are in the same transaction, while MAX cannot produce capture/proof/new admitting membership. Reset distinguishes committed-null exhaustion from failure. Native MAX reset/recovery and missing-meta checks above confirm those particular paths; remaining save/delete MAX transition and rollback variants are source reasoning plus supplied author evidence, not new independent browser assertions.

**Question2: capture, exact save/retry and distinct source identity.**

`saveSource:137–207` clones the original source and capture before asynchronous validation/hash work, strictly validates timed versus finite envelopes, computes the whole canonical source hash, and never reconstructs capture. Capture includes purpose and original capturedAt. Existing source bytes/hash and both physical partitions are checked before the write transaction, then synchronously compared again within the four-store transaction after hashing. Same-ID different content or two-partition presence fails rather than overwrites. An exact existing retry only reports membershipReady when the existing current member equals the exact original capture/kind/hash/member; missing, changed or orphan members are not repaired. Legacy identical retries remain legacy. A delayed old-epoch capture retains that old epoch across reset.

Source saved and policy eligible remain separate. Missing authority, uncaptured writes and membership failure cannot grant baseline status; the independent missing-meta case demonstrates it. `committed()` runs after transaction completion, catches channel construction/post/storage and subscriber failures as applicable, and cannot turn the tested durable MAX save into a persistence failure. Fault case C1 preserves this durable/result distinction but exposes separate uncaught callback errors.

Finite validation resolves the exact persisted plan identity through D and invokes E's separate validator outside live transactions; timed values retain the existing public timed validator and are never obtained by casting finite envelopes. E's corrected validator blob and its initial-key independent reacceptance were read as inputs, not reapproved here. Timed calibration/legacy API and mixed named export consumers are source-reviewed: both stores are read, cross-partition duplicates excluded/diagnosed, corrupt originals retained, and original finite sources use the explicit mixed envelope. Export is an explicit separate request, not an automatic second policy budget.

**Question3: one bounded native ledger and accepted-P3 compatibility.**

`coach-storage.ts:305–489` owns one WeakMap-backed ledger. Each materialized metadata/source/collision/member get reserves and charges an attempt before the native call, including missing/failed points. A source triple reserves both 1-MiB source/collision capacities and the4-KiB member capacity before traversal, plus final/admission compact allowances. Settlement releases unused byte reservation; the prefix measurer charges actual bounded inspection rather than full arbitrary serialization. Missing points charge zero bytes but a row. Shared caps are25 attempts/4MiB per cooperative slice and500/16MiB overall; count requests are at most4, key attempts at most min(1004,2*sourceAttempts+4). Counts begin null and only become known on actual count success.

The merged traversal uses two native key-only cursors and `indexedDB.cmp`; the retained raw keys are structured-cloned, never JSON/locale-normalized. Oversized, cyclic, deep or unsupported source/companion prefixes terminate the same ledger with record-limit, nullable exact oversized size and an explicit lower bound. Outer partition/prepare loops honor terminal state; no hidden second ledger or automatic fresh-cap retry exists. Final metadata points share the original ledger and reserve/charge again when actually requested. The independent real4-point failure and32→33 silent admission receipt exercise that linkage. The500/16MiB extremes, raw Date/binary/array continuity and other prefix edge cases were source-reviewed against C's distinctly labelled supplied browser evidence; this bounded review did not recreate its entire matrix or count prefill as native work.

Read accepted P3/H3 approval and the exact transferred fixture commit `dd779b5d8ecc95872c4252dc73620d6a2800e378`: only its `open()` helper's hard-coded v2 bootstrap becomes production `openDatabase()`, plus that import. Existing seed/count logic and assertions remain unchanged. This corrects the fixture's schema version for the new real upgrade; it does not weaken prior accepted assertions. The supplied235 history+354 byte assertions are author replay evidence, not this review's new counts. The independently replayed27 Node tests also include direct ledger/prefix tests, explicitly separate from native browser requests.

**Question4: completed proof before D, then a second real same-ledger admission check.**

`preparePractice:516–618` captures config/generation/now before awaits, clones/freezes config, gathers and hashes sources outside live transactions, uses D's real classifier only provisionally, and fixes full compact selection/ranges around the actual final proof. `metadataPoint:375–389` resolves on transaction completion and overlaps all four stores. Only an exact valid below-MAX metadata match creates the frozen `all-writer-revision` proof; only then is real D `derivePolicy` called. No coherent fallback or manufactured proof is implemented. This method is conditional on the closed writer inventory described above.

The actual source references include partition/kind/ID/full canonical hash/time, exact membership, metadata, captured now and all three complete/incomplete/not-requested ranges. D's actual runtime receives those bound values and the same proof; it does not establish transaction provenance from shape. The independent ready check verifies identity and immutable complete ten-source selection. The corrected aborted-final case and silent hashing-revision race return pending zero/no median/no focus, demonstrating that provisional witnesses are not published as a proved current result.

`admitPreparedPractice:624–643` requires the private live preparation entry, performs another reserved metadata point on that same ledger, rechecks full authority/metadata and invalidation, then reads `current()` after asynchronous work and again after the policy-module await. D receives the unchanged actual candidate/proof and latest generation/config/run state with no following await in C. The four late-local-state hostile callbacks, cloned-status refusal, valid original-proof admission and two real-page scenarios exercise these boundaries. C cannot know a UI's external generation without the caller; F must still discard late statuses and pass a truthful current callback at the real app insertion boundary. That integration was not independently asserted here.

**Exact source and execution receipts.**

`source-before.json` and `source-after.json` bind50 source/test/package/config paths to the requested Git pin and raw-byte SHA-256; `verify-source.mjs` freshly asserts each pin/blob and before/after hash, empty client diff and exact declaration mirror equality except the engine import. Representative reviewed Git blobs are:

| Path under `typing-app/client` | Git blob |
| --- | --- |
| `src/storage.ts` | `a65a6e2a1933ecac25049cc6e5444d59d990d3da` |
| `src/coach-storage.ts` | `ec62e02598b787c69be1891b54e4a63751ba1082` |
| `src/coach-types.ts` | `43f7c070788631e8014ee905dc634d55171cb38a` |
| `src/coach-policy.ts` | `a3868390989d6b8e84e370ee125fdfd3c19c0cce` |
| `src/finite-practice-result.ts` | `a1ea3f4c3d359ad3973ec8f6ba1b03111e88b9c7` |

Commands and result boundaries:

```text
# Repository root; helper launched hidden with exact identity recorded.
node typing-app/client/node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5325 --strictPort
# Playwright isolated browser_run_code_unsafe receives the async function exported by browser-runner.cjs.
# It creates/tears down each BrowserContext, imports probes.js only on guarded loopback5325, and returns receipts.
node docs/implementation/2026-11-16/baseline/implementation/storage-review/check-results.mjs
# exit1:60/63 pass, three retained failing containment assertions; clean fixtures verified.
node docs/implementation/2026-11-16/baseline/implementation/storage-review/verify-source.mjs
# exit0:50 files/pin/raw hashes/type mirror match.
node --check docs/implementation/2026-11-16/baseline/implementation/storage-review/probes.js
node --check docs/implementation/2026-11-16/baseline/implementation/storage-review/browser-runner.cjs
node --check docs/implementation/2026-11-16/baseline/implementation/storage-review/check-results.mjs
node --check docs/implementation/2026-11-16/baseline/implementation/storage-review/verify-source.mjs
# all syntax checks exit0.
# typing-app/client, unchanged lockfile:
npm ci
node --experimental-strip-types --test tests/storage.test.ts tests/history.test.ts tests/coach-storage.test.ts
npm run typecheck
# exit0 each:27 existing tests pass, TypeScript typecheck passes.
git diff --check
```

Node24.21.0, TypeScript7.0.2, Vite8.3.3, independent Chromium157.0.8103.79. `node-tests.txt` and `typecheck.txt` are fresh local receipts. Root's206 tests/typecheck/build and C's1024 browser assertions/two tabs are supplied evidence only; no new broad full-build/platform replay is claimed. There is no configured lint script; no lint/dependency tool was added. The temporary Vite root scan warning and corrected harness errors are retained separately and do not substitute for production evidence.

`dispatch-receipt.json` records requested and effective launch `codex / gpt-6.1-sol / high`, live provider projection `gpt-6.1-sol`, exact-worker observation and visible `GPT-6.1-Sol high`. These are actual Orca launch/display receipts, not independent attestation of backend-serving identity or a fabricated numeric effort conversion. No provider/account/global settings were changed.

`helper-cleanup.json` records owned Node PID6932, exact executable/arguments/cwd and sole strict5325 listener before stop, followed by PID absence, port freedom and removal of its two proven generated Vite cache files/empty directories. All final synthetic databases and owned browser contexts/pages were closed/removed; the isolated tool's default blank page was closed too. Exploratory fixture DBs were also removed by their finally blocks, with separate receipts or no adapter/open before harness failure. No root5301/F5324 process, actual `typeforge` database, user data, original checkout, Portfolio, account or deployment was touched.

Remaining work is the bounded C1 correction and independent recheck, then root's final combined C/D/F writer and app/UI acceptance. This review does not claim native AT/device coverage, OS-crash/disk-quota behavior, absolute latency/memory, human understanding or learning benefit. No owned helper remains and no production correction was silently repinned.
