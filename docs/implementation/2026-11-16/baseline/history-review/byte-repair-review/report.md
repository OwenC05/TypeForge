# H3 byte-work repair delta: APPROVE

18 November 2026. **APPROVE the bounded low-level repair of H3 R1 in source `3e3142587e3650ab36db27b6025e8490cb104d9d`, with the revised consumer contract at `5161dbaa5397b02e678ef4d1be7fe0a8cd8f8cbd`.** No remaining reproduced blocker was found within this delta. This does not approve later consumers, a combined root build, or all of Stage 1C.

The original request-changes review `b66ed8f884bee5d253d1b345f483f932beb8b671`, original reproduction `903e47fd775a67cd1c1010845016fa5c567ebc7a`, and their evidence remain unchanged. The defect in original `92803c80e4270dc5018b21b1e552c7feb7f97a2f` remains a reproduced defect; this report applies only to the repaired frozen inputs above. All new artifacts belong to this directory. No canonical source/test/package repair, helper agent, deployment, push or UI judgment was performed.

## What is accepted

`storage.ts:420-482` measures a bounded plain-JSON prefix rather than serializing/encoding the entire native value. `:525-536` charges the measured prefix and turns unsupported, cyclic, over-depth or oversized values into incomplete `record-limit`. `:554` prevents another value request in that slice, and `:596` propagates that terminal state through the whole automatic lookup. It does not replenish the exception after a yield.

The guarantee is bounded avoidable JSON-prefix inspection/expansion and bounded returned payload: each value requires a 1 MiB reservation; a slice stays within 25 examined rows/4 MiB and an automatic lookup within 500 rows/16 MiB. Fully measured supported JSON values have exact native UTF-8 JSON sizes; an oversized prefix stops within 1 MiB plus inspection of a scalar sufficient to establish non-fit. No full-record JSON string or UTF-8 buffer is allocated by this bounded path. Native materialization/key/count/enumeration/string-representation costs, structural work proportional to an admitted bounded tree, and an atomic operation's wall time remain outside an absolute physical latency/heap guarantee. This is the explicitly admitted native limitation, not the former repeated whole-payload expansion under a clamped counter.

## Independent original-counterexample replay

`independent-idb.js` repeats the exact 17 x 2 MiB real-IndexedDB input from the original H3 reproduction. It independently measures the fixture sizes before reading, then forbids native `JSON.stringify` and `TextEncoder.encode` during the read and counts **actual `IDBObjectStore.get` calls and `String.charCodeAt` inspections**. Thus acceptance does not depend solely on the reader's returned counters.

| Independent operation | Native value requests | Native whole stringify/encode calls | Actual scalar inspections, including keys | Outcome |
|---|---:|---:|---:|---|
| Fixed-clock slice | 1 | 0 / 0 | 1,048,560 | incomplete record-limit |
| Fixed-clock automatic lookup | 1 | 0 / 0 | 1,048,560 | incomplete record-limit |
| Ordinary-clock slice | 1 | 0 / 0 | 1,048,560 | incomplete record-limit |
| Ordinary-clock automatic lookup | 1 | 0 / 0 | 1,048,560 | incomplete record-limit |

All four report one examined row and one slice, 1,048,576 prefix bytes, unknown exact oversized total (`null`) and a 1,048,577-byte lower bound. All 17 source records remain stored. Adding one valid oldest row and performing 17 **explicit** continuations advances through each corrupt row once and then exposes the untouched valid tail; all 18 records remain stored before fixture deletion.

The independent mixed fixture places 62 valid rows ahead of an oversized record and a valid tail. With a fixed zero clock it traverses three slices; with injected 5 ms operations it traverses 32 slices. Both stop after exactly 63 native value requests and return the same 62 valid rows, charging 1,081,374 cumulative prefix bytes. The tail is available through explicit continuation only. These injected clocks exercise control flow, not device latency.

## Prefix and native-clone challenges

`prefix-probe.mjs` executes the exact private function text from the pinned snapshot using Node's built-in TypeScript stripper; it does not modify/export production code. Its **390 assertions** include:

- 325 native JSON-size differential cases, including a string containing every UTF-16 code unit, every escape class, paired/lone/repeated surrogates, non-ASCII property names, finite formatting extremes, nonfinite JSON-null tokens, negative zero, sparse arrays, null prototypes and repeated acyclic aliases.
- 40 exact-limit challenges: ASCII, two-/three-/four-byte Unicode, lone surrogates, control escapes, quotes and backslashes at 1 MiB minus two through plus two bytes. Exact fits remain accepted by the measurer; non-fitting tokens produce a bounded oversized prefix.
- Eleven stress/unsupported cases: a 16 MiB scalar, multi-MiB key, 150,000-property object, late cycle, depth 100, Map, Set, Date, binary, BigInt and undefined member. Native whole stringify/encoding are forbidden; scalar inspection remains bounded. Native property enumeration itself is not claimed constant-space or constant-time.
- Exact comparison, after CRLF normalization, proving that the extracted legacy structural body and public native JSON/UTF-8 size-check tail are unchanged by the helper split (`storage.ts:74-218`).

The **92 independent real-IDB assertions** separately exercise native clones, rather than relying on the extracted pure function. They include the original counterexample; prior row/time slices; a late cycle after a near-MiB string; deep trees; Map/Set/Date/binary/BigInt; a multi-MiB property name; a 120,000-property object; holes/aliases/nonfinite numbers; an accepted record containing controls, paired and lone surrogates; Date/binary/array raw compound cursor keys through structured clone; failed predicates, abort and recovery; diagnostic independence; retention; and explicit exhaustion after a terminal last record. The accepted Unicode record passes public legacy validation, returns successfully through the bounded reader and has its exact native byte size without a second native JSON/encoding pass.

No hazardous native whole-cycle serialization was invoked. Every browser run uses a fresh nonpersistent context, empty storageState, an owned strict loopback port 5317, and an outer watchdog; contexts close in `finally`. All independent corrected-path tests finish successfully with no page errors. Their operation duration observations are not performance claims under concurrent load.

## Contract and source conclusions

| Topic | Reviewed conclusion |
|---|---|
| Prefix accounting | Small/full plain-JSON trees match native bytes; nonfinite tokens count as JSON null and subsequently fail shape validation where required. Sparse slots count as null; aliases expand each occurrence while only active-path cycles are rejected. Depth 32 exceeds the valid schema. Unsupported values stop conservatively instead of invoking hooks. |
| Exact boundaries and underfill | Reserving 1 MiB can underfill a remaining allowance by less than 1 MiB. Existing exact 4/16 MiB, valid 1 MiB minus one/at/plus one and 499/500/501 row tests pass on this repaired input. The private differential adds escape/surrogate cutoff boundaries. Last-examined cursors preserve deferred values. |
| Diagnostics | `oversizedSerializedBytes:null` is deliberately unknown, never an exact total or zero. `oversizedByteLowerBound` is the proven prefix-size minimum; a cutoff does not prove that an unseen remainder is fully serializable. A cycle encountered after an admissible prefix is classified unserializable and charges its visited prefix. A prior cutoff can classify a large prefix before discovering a later cycle. No second full pass is used to improve a diagnostic. |
| Terminal reason | `record-limit` is incomplete even when the excluded record happens to be last. No lookahead is attempted after it; only an explicit continuation can prove exhaustion. Automatic `scanHistory` returns immediately, including after prior slices. |
| Counts/order/repeated reads | Compound reverse ordering, opaque keys, global unindexable counts and per-call diagnostic isolation retain their meanings. Replayed real-IDB fixtures plus independent native-key continuations pass. No cursor/order regression reproduced. |
| Failure/cancellation | Open/transaction setup/blocked/late-close Node tests pass in the full suite. Replayed browser tests exercise real transaction abort and invalid key recovery; independent corrected-path predicate failure/abort/recovery passes. Opener and legacy transaction functions have no repair delta. |
| Legacy semantics | The helper split preserves the exact structural validation body and native public size-check tail. Existing strict validation/save/export/model/assessment tests pass; no legacy semantics change reproduced. Explicit legacy full-history APIs are not newly bounded by this repair. |

**Consumer obligations:** callers that loop over `readHistorySlice` themselves must treat `record-limit` as terminal for their current automatic lookup; no silent retry. Preserve the opaque cursor without JSON conversion. Handle nullable exact oversized totals and lower bounds honestly. A failure envelope is diagnostic partial work, not a ready policy snapshot. `complete` proves exhaustion of the indexed range, not valid lifetime history, absence of unindexable records, a coherent multi-transaction snapshot or a future policy window's stopping rule.

## Fresh execution and provenance

| Check executed by this reviewer | Result / artifact |
|---|---|
| Independent pure-prefix/legacy probe | 390 assertions; `prefix-probe.mjs`, `prefix-result.json` |
| Independent real IndexedDB probe | 92 assertions, errors=[], fixture DB deleted; `independent-idb.js`, `independent-idb-result.json` |
| Repaired author's browser entry point, freshly replayed | 354 assertions, passed=true, failures=[]; `replayed-browser-result.json` |
| Existing browser entry point, freshly replayed | 298 assertions, errors=[], DB cleared; same receipt |
| `npm run check` in the pinned extracted client | 140/140 tests, TypeScript and Vite build pass; `full-check.txt` |
| Source/ownership checks | Seven source/test/package/parity normalized blobs match repaired Git; source receipt retains raw SHA-256 and exact inputs; final diff confined to this new directory |

The author's earlier counts were not treated as independent execution. This reviewer reran both entry points, then ran separate new probes. No lint command exists; no lint pass is invented.

Execution used a `git archive` extraction under this review-owned ignored `snapshot/`, with a junction to the already-installed locked dependencies. Windows archive output has CRLF; normalized Git blobs match the frozen input and raw hashes are retained in `source-receipt.json`. A strict raw-byte/source-body assertion initially rejected CRLF rather than a code difference; the equality check explicitly normalizes line endings. The first full-check extraction omitted `ml/fixtures/parity.json`, producing ENOENT in model tests (`initial-incomplete-snapshot-check.txt`); importing that exact frozen fixture resolved the harness omission and the final full check passed. Neither setup failure is an unexplained product regression. No dependency installation occurred.

Observed client: Orca terminal `term_2c47dfc8-d759-44bb-8d14-c4bb112c92da`, incarnation `8cee4b40-fbba-42a9-9499-d444cacce53a`, agentIdentity Codex, preview `GPT-6.1-Sol high`. Requested capable Codex/high was retained; this is client evidence, not serving-backend attestation. Node v24.21.0, npm 11.19.0, Chromium 157.0.8103.79. Source and contract/evidence commits are explicit above; the output commit is supplied with worker_done so it does not self-reference its hash.

The owned hidden Vite process PID 40404 was verified by PID, creation timestamp, executable and exact command before stopping. `cleanup.json` confirms zero remaining 5317 listeners and closed contexts. Root 5301, Claude 5312, Portfolio, the original TypeForge checkout and all other processes remain untouched. Runtime snapshot/junction/archive are ignored local artifacts; only this report, probes and receipts are committed.

## Acceptance boundary

R1 is resolved for the reviewed source and documented terminal-prefix contract. Root may integrate this low-level repair subject to its combined-build checks and consumer adoption of the new reason/nullable diagnostic. This acceptance does **not** implement or certify the future two-partition adapter, metadata/membership shared ledger, all-writer revision barrier, policy stopping proofs, UI lifecycle/General readiness, data-revision/cross-tab guards, metric-2 Undo, calibration migration or learning benefit. Those remain separately owned work. The original failing input and review are preserved for comparison.
