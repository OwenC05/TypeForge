# H3 byte-budget repair delta: ready for independent review

18 November 2026. Root-authorized task `task_7ae46df821ce`, dispatch `ctx_e24602d4e1c6`, worker `term_cb2740b2edd88a07c67abb2a9d4067f2`, coordinator `term_68fded65-2f85-497d-a32e-38f10342d6df`. **Repair source and tests committed as `3e3142587e3650ab36db27b6025e8490cb104d9d`; H3 acceptance and root integration remain pending.** This is the original P3 owner correcting the reproduced defect, not an independent approval. No redundant helper was launched. The original source was frozen at `92803c80e4270dc5018b21b1e552c7feb7f97a2f` / source `65f1a79`; H3 reproduction `903e47fd775a67cd1c1010845016fa5c567ebc7a` and final review `b66ed8f884bee5d253d1b345f483f932beb8b671` were read without modifying their artifacts.

## Reproduction before editing production

`plan.md` records the bounded repair sequence. The first added real-IDB regression seeded 17 exact 2-MiB indexable corrupt rows, independently checked each UTF-8 length, and instrumented **actual native JSON.stringify and TextEncoder output** rather than trusting examinedBytes. It ran against the unchanged frozen production code before any repair. `before.json` preserves **six failing assertions out of 17**: the fixed-clock default slice serialized/encoded 8 MiB against 4 MiB; fixed and ordinary automatic lookups serialized/encoded 32 MiB against 16 MiB. An ordinary slice happened to stop after one 2-MiB row because of the 8-ms scheduler; that was not counted as a byte-budget fix. All 17 source rows were retained and the fixture DB was cleared.

This reproduces H3's exact mechanism. The capped `Math.min(bytes, 1 MiB)` was wrong because full stringification/encoding had already happened. The original zero-byte charge when whole serialization threw also failed to account for large prefixes.

## What changed

Only three production/test files are in source commit 3e31425:

| File | Delta |
|---|---|
| `typing-app/client/src/storage.ts` | Separate the existing structural validator from the public legacy size-check wrapper; replace the bounded reader's whole-value stringify/encode with a bounded JSON-prefix byte traversal; carry a terminal record-limit state through automatic scanning; report unknown oversized totals honestly. |
| `typing-app/client/tests/browser/bounded-history.ts` | Failing-before overrun regression plus independent native allocation/scalar-inspection probes, differential JSON-byte oracle, exact valid limits, mixed/cumulative history, unsupported/late-cycle/16-MiB cases and multi-slice abort/continuation. Original assertions are retained except the deliberately revised oversized/cyclic return contract. |
| `typing-app/client/tests/browser/bounded-history.html` | Expose the new isolated test entry point; no application UI or build-entry changes. |

The new private `historyJsonBytes` visits only a bounded JSON prefix. It counts punctuation, escaped string characters and native JSON UTF-8 widths without allocating a whole JSON string or UTF-8 array. It handles control escapes, lone versus paired surrogates, finite number formatting, JSON null for nonfinite numbers (subsequently rejected by strict shape rules), sparse array slots and repeated acyclic aliases. It detects active-path cycles, rejects non-JSON clone types, and limits nesting to depth 32 (greater than the valid result schema). Property-name traversal avoids allocating an additional whole Object.keys array. This is a byte measurement over plain JSON trees, not a replacement general-purpose serializer or an invocation of user toJSON hooks. No second mutable source, module, dependency or storage architecture was introduced.

Each value reserves 1 MiB before being requested. Fully measured plain-JSON values consume their exact UTF-8 size, including invalid/incompatible rows. If the value exceeds that prefix, traversal stops before full expansion; the prefix consumes 1 MiB. A next scalar may be inspected to establish that its escaped token cannot fit, without allocating an oversized output. Cyclic/unsupported/deep values charge the prefix already visited before detection; the late-cycle fixture charges 1,048,422 bytes instead of zero. Shapes within the byte ceiling are then checked by `validateResultShape`, so accepted results are not serialized a second time.

The public `validateResult` still calls the same structural checks and the original native JSON/UTF-8 1-MiB check. Existing save/get/list/listResultsPage/export/assessment behavior and strict schema/metric acceptance are unchanged. This repair is confined to the additive bounded path; it does not claim that explicit legacy full-history export is now bounded.

## Return contract for A2 and other consumers

- `reason` adds **`record-limit`** for oversized, cyclic, unsupported or over-depth values. It is always incomplete and stops the current whole automatic lookup, even after earlier row/time slices. Consumers that loop over readHistorySlice themselves must carry the same stop; no automatic retry is allowed.
- `examinedBytes` measures completed JSON sizes plus any bounded examined prefix, not the unmeasured full size of an oversized native value. The 25-row/4-MiB slice and 500-row/16-MiB automatic constants are unchanged, as is conservative pre-admission underfill by less than 1 MiB. Actual traversal now stops at that prefix; there is no full serialization discounted afterward.
- `diagnostics.oversizedSerializedBytes` is now **number | null**: zero when no oversized exclusion occurred, null when the total was intentionally not measured. New `oversizedByteLowerBound` reports the known minimum, 1 MiB + 1 for the excluded oversized record. There is no second pass just to compute a total.
- The cursor remains the excluded row's last-examined opaque compound key. Following valid rows are untouched. An explicit new bounded lookup may continue after that cursor; it does not reread the excluded row or skip/duplicate the next valid row. Record-limit does not perform key lookahead and does not fabricate exhaustion, even if the excluded value is actually the last record.
- Native IndexedDB still materializes one record before its arbitrary size/type is known. Record-limit stops further automatic materializations after an unsupported/oversized value. Native clone/key/count/enumeration costs and a single atomic operation's time/heap cannot be strictly capped with the present representation. No dual-partition, epoch, provenance or app-lifecycle architecture was implemented.

`../history-contract.md` contains the revised current interface; `../report.md` is explicitly marked as the historical initial report with the original byte claim superseded. Frozen evidence remains intact. General-first, generation/revision guards, policy-window proofs, exact assessment calibration and versioned Undo remain root-owned integration dependencies.

## Fresh verification

| Check | Result |
|---|---|
| Targeted Node history + storage tests | 18/18 passed after source repair. |
| Final `npm run check` from typing-app/client | 140/140 tests, TypeScript and Vite build passed; `final-check.txt`. No configured lint script exists, so no lint pass is claimed. |
| Repaired browser entry point | **354 assertions**, passed=true, failures=[], fresh Chromium 157.0.8103.79; `after.json`. |
| Original browser entry point with explicit new record-limit expectations | **298 assertions**, 11 groups, errors=[], database cleared; same fresh receipt. Count varies with real-clock slicing and is not a performance comparison. |
| H3 exact seeding comparison | `h3-fixture-comparison.js` keeps 903e47f's 17 x 2-MiB seeding, adapting only owned port/repaired expected states. Controlled slice, controlled automatic and ordinary automatic each examine one row/one slice, charge one bounded MiB prefix, return incomplete record-limit with unknown total and preserve all 17 rows; `h3-fixture-comparison.json`. This is author verification using H3's fixture, not fresh independent acceptance. |
| Scope/whitespace | Source commit owns only storage and its existing browser fixture; staged whitespace checks pass. No package/lock/app/style/engine/model/schema changes. |

For each of the four fixed/ordinary slice/automatic regression cases, independent probes observe **zero whole-record stringify calls and zero encoded-buffer bytes**. A separate monkeypatch counts actual long-string charCodeAt calls: **1,048,484 inspections** of each 2-MiB pad, below the 1-MiB prefix allowance, not a traversal of the entire pad. The 16-MiB plain/cyclic pad cases have the same inspection count, proving that the path stops before expanding those full values. A late cycle after a 1,048,320-code-unit pad charges its visited prefix and returns one record-limit; native whole-cycle stringify is forbidden by a fail-fast spy. All native-cycle tests use only the corrected bounded path and a 25-second outer watchdog; H3's hazardous native serialization stress was not blindly rerun.

Additional cases cover native byte-for-byte differential checks for **140 JSON fixtures**, valid records at 1 MiB - 1 / 1 MiB / 1 MiB + 1, a four-exact-MiB valid slice and untouched fifth valid row, 89 mixed valid/invalid/incompatible rows across four slices before the first record-limit, explicit valid-tail continuation, cycles/Map/Date/bigint/binary/depth cutoffs, and cancellation on the 26th valid row with subsequent recovery. Legacy semantics, exact row/byte exhaustion, cursor tie order, corrupt retention, pre/during-open cancellation, blocked/failure paths, ordinary-clock cumulative budgets and deterministic 8-ms scheduling remain covered by the original suite.

No performance verdict is claimed. Native/scalar processing can overshoot 8 ms; the receipt reports those observations and the scheduler yields before subsequent ordinary work. Fixed clocks and instrumentation isolate correctness, not device latency. The API cannot preempt one native clone or synchronous operation. Browser tests remain an explicitly run fixture rather than a new npm/CI dependency.

## Resources, provenance and handoff

The isolated Playwright connector supplied fresh nonpersistent contexts with empty storageState; every context closes in finally. Test server PID **62980** used only strict loopback **5319**, hidden at launch. `fixture-process.json` and `fixture-close-identity.json` record cwd, exact command and matching start/PID before stop; final `cleanup.json` confirms process absent and zero port-5319 listeners. The immediate post-stop check raced asynchronous process exit, then a follow-up confirmed final cleanup. Reserved root/H3/Claude ports 5301/5317/5318 were not used or stopped. No upload, push, deploy, paid work or global/provider/account setting change occurred.

`source-receipt.json` pins the repaired commit, raw local hashes/Git blob IDs, exact independent source/repro identities and runtime versions. Logs were converted from PowerShell capture to UTF-8 without changing command outcomes. `execution-receipt.json` distinguishes requested Codex gpt-6.1-sol/high and observed live terminal preview from the resumed ancestor process, which exposes no model/effort argv flags; this is client evidence, not serving-backend attestation.

Remaining acceptance belongs to **independent H3 delta review**, then root/A2 integration with the revised stop/nullable-diagnostic contract. Native clone/key/count limits, UI readiness/race guards, provenance/partition architecture, metric-2 Undo and policy efficacy remain explicit separate work. The worker has completed the authorized repair and verification; it does not certify its own independent acceptance.
