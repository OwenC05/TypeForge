**APPROVE C1 correction and the bounded C storage/proof source scope.** The three callback-containment failures from original REVISE `f6a92561c57a4cf4abd65af0d27c92c3952ad75e` are closed by exact supplied correction `7109d2c53120ba67388e07609254dc825e8ac5a4`. No remaining concrete C defect was found in this recheck. This is C source/proof acceptance within the original all-writer contract, not F app/UI, D numeric, final combined browser, platform or human-benefit acceptance.

Task `task_158b0803a865`, dispatch `ctx_49b7c42f7ead`, existing child `tf-coach-storage-review`, terminal `term_375bd675-235f-4566-993d-459d2c064cc4`. The original report, all three original failing assertions and every one of its19 artifacts remain unchanged. Root explicitly authorized consumption of only7109d2c; it was cherry-picked without conflict as **`7008f4bab52e6e46c1a57fef1602da3dfa890b5a`**. No moving root/F source or author evidence commit was merged. Root already has this source as2e7f8ea; it should import the new review-evidence commit separately.

Read the root recheck brief, author containment report/execution receipt at supplied evidence `07a72a2f151a84cbd8a0bda1e79ca2423645ff01`, the complete two-module production delta, and all three test/fixture changes. Author46 focused/63 overlapping full replay assertions and207 C-child tests, plus root235 combined tests/typecheck/build, are supplied evidence only. No author browser fixture was replayed in this reacceptance.

**Fresh execution:63/63 original-review assertions replayed, plus36/36 new independent assertions.** These are99 successful assertions, with the original three callback cases'18 checks included within63 rather than added again. `replay-results.json` and `secondary-results.json` retain every result, native request list, work counter and cleanup receipt. All13 passing scenarios use fresh isolated Chromium157.0.8103.79 contexts,15 actual pages and uniquely named UUID synthetic databases. All13 databases were explicitly deleted and native absence verified; contexts/pages closed. Zero page errors and zero unhandled rejections were observed; observers never suppress either event.

| Finding / surface | Reacceptance evidence |
| --- | --- |
| Upgrade `metadata.add` callback | Exact original native fault now rejects cleanly without pageerror; v2 version and original canonical legacy bytes remain, no partial authority/current/member commits, and clean upgrade retry works. New10-assertion case also calls native abort then deliberately throws a secondary InvalidStateError: original primary rejection survives, native abort is called once, legacy remains unchanged, ordinary captured save after retry succeeds and revision advances once. |
| Delete callback | Exact original current-store delete fault still rejects and preserves source/revision with no pageerror. New13-assertion secondary-abort case also verifies exact original protected-purpose capture/member and full authority preservation, zero committed notification on failure, idempotent original-capture retry without revision increment, then successful explicit deletion retry removing source/member atomically with one increment/notification. |
| Nested member point continuation | Exact original failure returns terminal incomplete rather than pageerror. New13-assertion secondary-abort case physically observes exactly four attempted native gets: metadata, current source, missing legacy counterpart, failed member. Ledger rows remain4 with one native abort and no double settlement; same-ledger continuation issues no new attempt or budget. Metadata/exact membership stay unchanged; an explicitly new fault-free lookup returns the original source/member and ordinary exact save retry remains ready. |

The new secondary-abort probe invokes the real native abort **before** injecting the secondary already-aborted exception. It tests containment without inventing a browser where failed abort silently commits partial work. API faults are deliberately injected, while storage, rollback, request scheduling and cleanup are real native IndexedDB operations. This is not OS quota/crash evidence.

The remaining original replay cases preserve missing-metadata recovery without bootstrap/member repair, committed-null MAX reset and ordinary recovery despite denied notifications, the silent fenced deletion during asynchronous hashing, immutable ten-source selection, same actual C proof across real D projections/admission, late generation/config/running/disposed rejection, cloned-status refusal, final overlapping transaction abort with no provisional count/median/focus, and two real-page invalidation scenarios. Normal notifications reject stale admission before another point; with both channels disabled, the same preparation ledger advances32→33 for the reserved second authority read and rejects the peer's real production deletion. Neither fake proofs nor numeric/D semantics are reconstructed here.

**Why the broader catches preserve correctness.** The upgrade catch sets the attempt closed, removes its signal listener, attempts versionchange abort and rejects the original cause; existing late-success closure remains. The delete catch surrounds every source/member deletion and metadata write and rejects after attempting abort, so a partial queue cannot resolve as committed deletion. `changed` cannot cause a committed notification after rejection. The point callback catches its asynchronous ready continuation only after the parent point has settled; the nested failed get already reserved/settled its own failure. The catch aborts without settling twice, and the existing transaction-abort path returns incomplete. Directly related save/source-scheduling abort guards contain only a secondary exception; source operations, validation, authority, reservations, limits, proof construction and admission order are unchanged. No global error suppression was added.

**Exact inputs and preservation.** `input-before.json` and `input-after.json` bind50 client source/test/package/config paths and all19 original review artifacts by Git blob and raw SHA-256. `verify-input.mjs` checks that only the supplied five changed paths match7109d2c and that all45 remaining paths and every prior artifact retain their exact original bytes. The full small production delta is only these two modules:

| Module | Original Git blob | Corrected Git blob |
| --- | --- | --- |
| `typing-app/client/src/storage.ts` | `a65a6e2a1933ecac25049cc6e5444d59d990d3da` | `a46a0a62eed07507ca0c2b4c0f23ce41c8cb1036` |
| `typing-app/client/src/coach-storage.ts` | `ec62e02598b787c69be1891b54e4a63751ba1082` | `07371e38c33de1531e40440102c688fb31581bdf` |

The supplied test-only changes are `tests/storage.test.ts` blob `d3b370dca10652878cc53df23660a3ba5bf1ae76`, `tests/browser/coach-storage.ts` blob `8d924b5a9d3ad4f8c7958a46aae555487a2e359e`, and its HTML blob `cb7b10b6eb8b48df867c7b328ef593b89932510f`. Frozen types `43f7c070788631e8014ee905dc634d55171cb38a`, real D policy `a3868390989d6b8e84e370ee125fdfd3c19c0cce` and accepted finite validator `a1ea3f4c3d359ad3973ec8f6ba1b03111e88b9c7` remain unchanged, as do engine/config/catalogue/plan/corpus/package/lock/app/unsaved dependencies. No production patch was authored by this reviewer.

The copied `probes.js` is byte-identical to the original (SHA-256 `069561e15edd151465419ff8bd4628a10500185b8a38ee4beaedaa02a8e28b4d`). `prepare-probes.mjs` and `adaptation.json` record runner-only changes: move its probe URL into this leased directory, generate UUID names for both real-page cases, and passively record unhandled rejections. Every original assertion remains unchanged. `secondary.js` contains the36 new assertions; these are independent reviewer additions, not the author's28 regressions.

Commands and fresh results:

```text
node docs/implementation/2026-11-16/baseline/implementation/storage-review/containment-recheck/verify-input.mjs --before
git cherry-pick 7109d2c53120ba67388e07609254dc825e8ac5a4
# clean import as7008f4bab52e6e46c1a57fef1602da3dfa890b5a
node docs/implementation/2026-11-16/baseline/implementation/storage-review/containment-recheck/verify-input.mjs
# before runs before import; after verifies exact correction/dependencies and original evidence
node typing-app/client/node_modules/vite/bin/vite.js --config docs/implementation/2026-11-16/baseline/implementation/storage-review/containment-recheck/helper.config.mjs --host 127.0.0.1 --port 5325 --strictPort
# hidden owned helper; browser_run_code_unsafe receives functions from browser-runner.cjs / secondary-runner.cjs
node docs/implementation/2026-11-16/baseline/implementation/storage-review/containment-recheck/check-results.mjs
# exit0,63 replay +36 new independent assertions, all cleanup/error checks pass
# typing-app/client, existing installed dependencies; no install or lock change:
node --experimental-strip-types --test tests/storage.test.ts tests/history.test.ts tests/coach-storage.test.ts
npm run typecheck
# exit0 each:28 targeted tests pass; TypeScript7.0.2 typecheck passes
git diff --cached --check
```

Syntax checks for all new JS/CJS/MJS probes/scripts pass. Node24.21.0 and Vite8.3.3 remain unchanged. `node-tests.txt` and `typecheck.txt` are fresh replays of existing tests, distinct from99 browser assertions. No full build, broad numeric/platform audit, new lint tooling or dependency change was needed. Root's235 combined pass remains supplied evidence, not this child's count.

One initial replay lost its first page's execution context to navigation, with56 later assertions passing and no production pageerrors. It is retained as `replay-initial-incomplete.json`, excluded from acceptance and not added to the counts; all10 contexts/12 pages closed and nine completed cases explicitly deleted their DBs. Its first explicit cleanup evaluation was unavailable after navigation, so no named deletion receipt is claimed for that lost context; the fresh ephemeral browser context was closed. An identical runner rerun produced the complete63/63 result with every named DB explicitly removed. No pending or unknown owned browser context remained. This fixture navigation is not presented as a product defect or silently counted as success.

`dispatch-receipt.json` exposes live exact-worker/provider projection `codex / gpt-6.1-sol` and visible `GPT-6.1-Sol high`. Because this is a reused terminal, this dispatch's requested model/effort and effective model/effort fields are null. The original launch receipt remains preserved separately; no backend-serving effort/model is inferred or configuration changed.

`helper-cleanup.json` records verified owned PID69676, exact Node executable/config/arguments/cwd and sole strict5325 listener before stop, followed by process absence and port freedom. Probe cache and repository cache are absent; the dedicated helper config directs any cache inside this lease and disables dependency discovery. All passing13 contexts/15 pages are closed, as are the excluded attempt's10 contexts/12 pages and the tool's default blank page. No root5301/5302, F5324 or UI-review5326 helper was touched. No actual `typeforge` DB, user data, original checkout write, Portfolio, account/global setting, deployment or push occurred.

No remaining C1 correction is required within this exact source scope. Root's final integrated all-writer/app lifecycle inventory, actual-Claude UI acceptance and combined browser validation remain separate; native AT/device, real OS faults, absolute latency/memory and human learning claims remain outside this approval. Only new `storage-review/containment-recheck/` evidence is committed after the supplied source import, and no owned helper remains.
