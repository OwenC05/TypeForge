# H3 independent technical review: request changes

Review completed 18 November 2026. **One HIGH blocker reproduced in frozen `92803c80e4270dc5018b21b1e552c7feb7f97a2f`: the charged-byte cap does not enforce the Stage 1C serialized-payload work budget.** Root acknowledged and routed repair to the original P3 owner. This is a completed review with an expected defect reproduction, not a clean approval or a source repair.

## Exact scope and source

- Review input: `92803c80e4270dc5018b21b1e552c7feb7f97a2f`, implementation `65f1a794cefb7dc06baf699ab338f0619889f0fe`, base `c65460b91ab2b310cb51f2f8cd4247d6c9f7c482`.
- Read canonical Git versions of the production delta in `typing-app/client/src/storage.ts`, both new test files and browser HTML, `.omx/plans/prd-typeforge-review-breakdown.md` Stage 1C, the baseline plan/worker brief, and P3 report/contract/source/execution receipts. Production differences are confined to storage; no moving-branch source was substituted.
- `source-receipt.json` verifies that local normalized blobs for source, tests, fixture, package and lockfile match the frozen objects. The review branch began at the exact frozen commit. All review commits own only this directory.
- Solo dispatched reviewer; no helper agents. Live Orca terminal receipt identified Codex and displayed `GPT-6.1-Sol high`; this is client evidence, not backend attestation. No global model/account settings were changed.

## Ranked finding

### R1 — HIGH: repeated oversized payloads exceed the actual serialized-byte budget

**Location at the frozen source:** `typing-app/client/src/storage.ts:456-469`, especially `:465`; propagation at `:508-530`. Requirement: `.omx/plans/prd-typeforge-review-breakdown.md:139`. The weaker interpretation is documented in `docs/implementation/2026-11-16/baseline/reliability/history-contract.md:15` and the P3 report's bounds section.

The reader fully calls `JSON.stringify(value)` and UTF-8 encodes its result before deciding whether it is oversized. It then adds only `Math.min(bytes, MAX_RESULT_BYTES)` to the counter governing subsequent work. Thus an arbitrarily large excluded value costs at most 1 MiB in that counter. `scanHistory` carries this capped counter forward and automatically continues serializing further oversized values after yields. The separate `oversizedSerializedBytes` diagnostic truthfully exposes the larger work but does not control admission.

**Concrete reproduction:** run `oversized-repro.js` with the Playwright run-code surface against this frozen checkout on strict loopback port 5317. It creates a fresh nonpersistent browser context and 17 exact 2 MiB JSON records, all indexable by the real compound index and invalid because of the extra `pad` field. No valid record or application data is needed. See `oversized-result.json` from commit `903e47fd775a67cd1c1010845016fa5c567ebc7a`.

To rerun, verify 5317 is free, then from `typing-app/client` start `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5317 --strictPort` as an owned hidden helper. Pass the file's entire text as the `code` argument to `mcp__playwright_isolated__browser_run_code_unsafe`; it is an async Playwright callback, not a standalone Node script. Stop only that exact helper after checking its PID/start/command identity. The main independent and native-reduction files use the same callback surface and manage their own fresh contexts.

| Operation | Examined rows | Charged bytes | Actual serialized payload | Result |
|---|---:|---:|---:|---|
| Fixed-work-clock default slice | 4 | 4 MiB | 8 MiB | incomplete / byte-budget |
| Fixed-work-clock automatic lookup | 16 | 16 MiB | 32 MiB | incomplete / byte-budget, 4 slices |
| Ordinary-clock automatic lookup | 16 | 16 MiB | 32 MiB | incomplete / byte-budget, 10 slices in the minimal receipt |

The broader final probe independently repeats the same byte totals; its ordinary-clock scheduling produced 16 slices. Slice counts and operation durations are uncontrolled observations, not performance comparisons. All 17 records remain stored until explicit fixture cleanup. Explicit continuation retains the final row without skipping it.

**Expected behavior:** the 4/16 MiB limits must constrain actual avoidable payload traversal/serialization/encoding work. An unavoidable native one-record materialization is admitted by Stage 1C and is not itself a bug. It does not authorize repeatedly serializing whole oversized records or restarting that exception on every automatic slice. Documenting a charged counter and publishing overshoot does not change the original guardrail. The 8 ms scheduling policy controls when to yield, not total automatic payload work.

**Repair acceptance, owned by P3:**

1. Bound validation/size inspection/serialization before expanding arbitrary corrupt graphs or encoding their full payloads. Cheap strict structural rejection or a bounded traversal can satisfy this; the reviewer does not prescribe a new module/dependency. Merely clamping a reported count, or measuring the full oversized payload and then ignoring its cost, cannot satisfy acceptance.
2. Make actual work accounting and stop state flow through the entire automatic lookup, including between time/row slices. If any single-record exception remains, define it explicitly and stop/charge conservatively so it cannot repeat inside one automatic lookup. Native materialization remains separately admitted; avoidable full JSON/string expansion is not a native necessity.
3. Handle cyclic/non-JSON values conservatively. Frozen `:459-463` increments rows but charges zero bytes when serialization fails; a graph with a large prefix must not bypass the work budget by throwing. Preserve per-call diagnostics without requiring an unbounded second pass solely to obtain an exact oversized size.
4. Instrument the actual bounded traversal/encoder work in independent tests, rather than asserting only `examinedBytes <= cap`. Include 17 x 2 MiB, one substantially larger corrupt row, late-cycle/unsupported values, mostly invalid/incompatible values, and a valid tail. Cover fixed work clocks and ordinary scheduling; automatic resumption must not replenish total work allowance. Retain corruption and exact opaque cursor continuity.
5. Recheck valid below/at/over boundaries, conservative underfill, exhausted-at-limit proofs, row caps, abort/failure cleanup, and legacy APIs. The 4/16 MiB constants remain unchanged unless root records a separate measured contract revision. A corrected commit needs independent review; none is certified here.

No separate reproduced blocker was found in the other reviewed storage paths. This finding blocks claiming that the bounded foundation meets Stage 1C.

## Other technical conclusions

| Area | Evidence and conclusion within this bounded review |
|---|---|
| Legacy behavior | The only changed existing path is the optional-signal opener. Non-signal callers retain the existing version/index upgrade, blocked/error rejection and late-close behavior. All 140 tests pass, including existing validation/save/export/lifecycle coverage; fresh IndexedDB legacy pagination and `listResults` diagnostics also pass. No legacy regression reproduced. |
| Ordering and continuity | Existing real-IDB tests cover tied timestamps, interleaved invalid rows, small/raw keys, and exact row boundaries. Independent one-row continuations additionally cover Date, ArrayBuffer and nested-array compound keys through `structuredClone`; each of three indexable invalid rows is examined exactly once. JSON/URL cursor conversion is explicitly unsupported. |
| Counts and exclusions | Each slice counts the entire store and index in its transaction; their difference is the global unindexable count, not a count of exclusions encountered after `before`. It is not summed per slice. Independent mixed data gives invalid=1, incompatible=1, unindexable=1 with rowLimit=2; the next call returns both valid tail records. Count/native key work remains browser dependent. |
| Completion | Key-only lookahead tests exhaustion before applying the next-value budget, so exact row/byte exhaustion can be complete without loading an extra value. `complete` means exhausted indexed range, including when every examined row was excluded; it never proves complete valid history, absence of unindexable rows, or an exact supported policy cohort. A provided cursor defines a suffix, not full lifetime history. |
| Reservation/underfill | Reserving 1 MiB before each value conservatively underfills by less than 1 MiB for normal serializable rows; with a 1 MiB allowance a small first value can cause a byte-budget stop. The last-examined cursor leaves the untouched next value resumable. This documented tradeoff is not an additional defect. It does not make oversized reservation accounting conservative. |
| Abort/blocked open | Eight Node tests cover pre-abort, abort during open, blocked/error open, late-close and transaction setup failure. Real-IDB fixture covers abort inside the compatibility predicate; the independent probe additionally blocks a v1-to-v2 upgrade, verifies explicit failure, closes the v1 connection, retries successfully, and deletes the DB without a blocked connection. |
| Failed predicate/transaction | Existing real-IDB tests cover abort, throwing predicate, invalid key and recovery. Independent predicate failure returns incomplete diagnostic partial work with the attempted cursor and no active owned abort listeners; subsequent reads recover. Redundant listener removal is harmless. A failed predicate has not classified its last row; callers must restart failed preparation rather than publish/continue its envelope as a ready snapshot. |
| Diagnostics/repeated calls | Independent calls return independent diagnostics, preserve legacy warnings even after a legacy corrupt-history read, and return deterministic results when repeated with a structured-cloned cursor against unchanged data. No mutable diagnostics crossover reproduced. |
| Result limits | Results are a subset of examined rows: <=25 per slice and <=500 per automatic lookup. Filters/corruptions consume examined-row limits. `scanHistory` is an aggregate reader, not a visible history page. UI mounting/page limits remain an unimplemented consumer requirement. |
| Scheduling | Existing deterministic tests exercise 8 ms accumulated processing and a 9 ms nonpreemptible operation with reported overshoot; automatic reads yield between slices. Measured work excludes browser request/materialization latency and is not an absolute wall-clock/heap bound. No timed-performance verdict is made. |

## Test adequacy and independently executed evidence

| Check | Fresh result |
|---|---|
| `node --experimental-strip-types --test typing-app/client/tests/history.test.ts` from repo root | 8/8, `targeted-tests.txt` |
| `npm run check` from `typing-app/client` | 140/140, TypeScript and Vite build pass, `full-check.txt` |
| Frozen `runHistoryChecks()` in a fresh context | 265 assertions, 11 scenario groups, no page errors, DB cleared, `existing-browser-result.json` |
| Independent `oversized-repro.js` | Expected R1 contract failure reproduced under controlled and ordinary clocks; all 17 rows retained; fixture DB deleted, `oversized-result.json` |
| Independent `adversarial-browser.js` final version | 23 assertions, no page errors, real DB deleted, `adversarial-result.json` |
| `git diff --check` and frozen/local blob comparison | Pass; six source/package/test blobs match frozen Git; no source/package changes |

The existing tests are useful but insufficient for the byte-work claim. In particular, `tests/browser/bounded-history.ts:80-82` checks only the capped `examinedBytes`; `:168-175` explicitly expects the `Math.min(bytes, MIB)` interpretation. Its oversized fixture is only one byte above the per-record ceiling. Neither proves a physical serialized-work bound for successive oversized values. Prior P3 executions were read as receipts, not counted as this review's runs.

No lint script exists in the frozen package; no lint pass is claimed. `npm ci --no-audit --no-fund` installed the existing lockfile locally; package/lock blobs remain unchanged. An initial targeted-test command used the wrong working-directory-relative path; it is preserved as `initial-command-path-error.txt`, corrected immediately, and is not a product regression.

## Cyclic/native-operation limitation retained explicitly

An initial wider probe successfully processed 30 cyclic 1 KiB-pad records: 25 rows/zero charged bytes in a slice, then all 30/zero bytes in an automatic lookup (`adversarial-result-initial.json`, 25 assertions). Later cyclic stress attempts tripped health watchdogs inside serialization, including one 1 MiB cyclic record. `initial-adversarial-timeout.json` and `cyclic-followup-timeout.json` preserve those failures rather than counting them as passes.

`native-cycle-probe.js` reduces this without importing storage: create a cyclic object with a 1 MiB string, store/read it through native IndexedDB, verify `clone.self === clone` and string length, then call native `JSON.stringify(clone)`. The bounded watchdog expires after the native clone-read log on Chromium 157.0.8103.79 (`native-cycle-result.json`); serializing the original JS-created cycle rejects before that. This local observation does not establish an upstream browser defect, an introduced storage regression, or a reproducible latency threshold under controlled load. It demonstrates why whole-value serialization of arbitrary native clones is not an acceptable work-bound proof. This is retained under R1's repair envelope and the admitted nonpreemptible-operation limitation, not counted as a second independent blocker or silently converted to a pass. Final stable probes omit that stress case; future corrected-source acceptance must revisit bounded traversal of such graphs.

Browser receipts record actual versions: initial existing/minimal runs used 157.0.8103.52; final adversarial/native reduction used 157.0.8103.79 after the session crossed dates. No comparison of those versions' speed or reliability is claimed. Every fixture uses a fresh nonpersistent context with empty storage state and owned strict port 5317. The Orca browser guide does not expose fresh-context/profile isolation, so the isolated Playwright connector supplies it. Contexts close in `finally`, including watchdog paths; no user profile, root port 5301, Portfolio or original checkout is used.

## Explicit integration boundary and handoff

Storage tests do not implement or certify General readiness, lifecycle generation/data-revision guards, mutation/cross-tab invalidation, idle/pre-insertion selection, frozen active runs, UI/export labels, mounted row limits, policy-specific stopping proofs, provenance sidecars, metric-2 Undo/Redo, compatibility migration or recommendation efficacy. Separate readonly transactions are not a coherent multi-slice snapshot. Future consumers must reject stale/incomplete results, maintain generation/revision/policy identity, and distinguish indexed exhaustion from their reviewed policy window proof. Existing assessment newest-ten calibration and exact retest resolution remain separate semantics.

Root owns repair routing and integration; original P3 owns source repairs. Initial blocker message `msg_7abec8122acb` and minimal-repro handoff `msg_3bceab8272e3` were sent early. No production/test repair, package change, UX verdict, push or deployment was made. Only review-owned probes, reports and receipts are committed. `cleanup.json` records the owned server identity check and shutdown; no broad process cleanup is authorized or used.
