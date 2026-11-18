# Root integration: independently approved bounded history

18 November 2026. Integrated the additive bounded-history foundation and its byte-work repair at **`29d58f4`**, then imported independent H3 acceptance at **`b99cadd`**. Accepted source is `3e3142587e3650ab36db27b6025e8490cb104d9d`, contract/evidence `5161dbaa5397b02e678ef4d1be7fe0a8cd8f8cbd`, and independent review `884dbec81b1035da253d563bae0672c23d6a06b6`.

The original failure fully serialized repeated oversized records while charging a capped counter. The corrected reader examines a bounded JSON prefix and terminates its current automatic lookup with incomplete `record-limit` on an oversized/unsupported/cyclic/deep record. It preserves the opaque cursor and stored source. Exact oversized totals are unknown (`null`), with an explicit lower bound. Accepted finite JSON values retain exact native byte sizing. The public legacy validator's structural and size checks retain their meaning.

Root verified that the four integrated storage/test/fixture Git blobs exactly match H3's accepted input. Existing UI/styles and tooling patches were retained; user-owned skill/config changes remain unstaged. [verification.json](verification.json) pins the source identities, merge, runtime and checks.

## Fresh combined checks

- **140/140 tests**, TypeScript and Vite **8.3.3** production build pass. [check.txt](check.txt).
- Replayed the original **17 × 2 MiB** generated IndexedDB fixture against the integrated source using an isolated context and temporary strict loopback port 5320. Controlled slice, controlled automatic scan and ordinary automatic scan each stop after one examined record/one bounded MiB prefix with `record-limit`, unknown full total and retained source rows. All 17 rows remain stored before fixture cleanup. [oversized-result.json](oversized-result.json).
- The rebuilt app at root preview 5301 passes **46/46 native typing-flow assertions**, no page errors, in Chromium 157.0.8103.79 with isolated contexts. This covers start, native editing, focus, repeat, persistence/recovery and the existing flow boundaries. [typing-flow-result.json](typing-flow-result.json).
- **13 HTML entries / 21 emitted files** return HTTP 200 and match disk SHA-256s. The specified development-marker scan is empty. [build-correspondence.json](build-correspondence.json).

The root oversized replay checks integrated behavior against the already independently instrumented source; it is not another independent low-level audit. H3's separate acceptance includes 390 prefix/legacy assertions, 92 real-IDB assertions, native value-request/allocation instrumentation and fresh replays of the broader suites. See [the independent report](../history-review/byte-repair-review/report.md).

Temporary hidden fixture PID 37140 was matched against its saved executable, command and creation time before stop. Cleanup confirms no remaining 5320 listener. Root preview PID 28552 remains on **http://127.0.0.1:5301/**. [cleanup.json](cleanup.json). No other process, workspace, deployment or real browser profile was modified.

## Acceptance limits and next consumers

This accepts the low-level additive reader, not every Stage 1C consumer. Existing app readers are not replaced by this merge. New policy/history consumers must treat `record-limit` as terminal for the current automatic lookup, preserve raw cursors, expose incomplete proofs honestly and distinguish nullable oversized totals from zero. An explicit continuation can resume after the excluded row; an automatic loop cannot silently grant another budget.

Native IndexedDB materialization, key/count/enumeration work and an individual operation's time/heap remain browser-dependent; no absolute latency, memory or learning benefit is claimed. The future legacy/current partition adapter, membership/metadata shared ledger, all-writer revision barrier, policy stopping proofs, UI lifecycle and metric-2 work remain separate. No personalized-practice behavior is implemented by this integration.
