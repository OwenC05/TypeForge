# C1 callback containment correction

18 November 2026. Author follow-up task `task_f99da6f5a75b`, dispatch `ctx_025dee1530fe`, worker `term_91a87a2c-35f4-4f89-ad58-a671da407c1f`. This is a correction ready for root's independent recheck, not independent approval or F/app acceptance. Root supplied brief31bd4c4 and independent REVISE evidence f6a92561c57a4cf4abd65af0d27c92c3952ad75e (root13ce9dc); that evidence remains untouched.

## Source and change

The child started clean at d796f2e2e48219fc701c5d8692a276682269d188. Its two production blobs matched the frozen independent review before either replay or production edits:

| Module | Red blob | Corrected blob |
| --- | --- | --- |
| src/storage.ts | a65a6e2a1933ecac25049cc6e5444d59d990d3da | a46a0a62eed07507ca0c2b4c0f23ce41c8cb1036 |
| src/coach-storage.ts | ec62e02598b787c69be1891b54e4a63751ba1082 | 07371e38c33de1531e40440102c688fb31581bdf |

Source/tests commit: **7109d2c53120ba67388e07609254dc825e8ac5a4**. Only the two C modules and three existing leased test/fixture files change in that commit. No F/app, policy, engine, type, config/catalogue, dependency, package/lock or numeric-rule edit was made, and no newer F branch was merged into this child.

- Upgrade catches synchronous failures inside `onupgradeneeded`, marks the open attempt closed, aborts the versionchange and rejects the original cause. A late success still closes. A failed metadata add cannot commit v3 authority or lose the v2 source.
- Delete catches the whole metadata-success callback, including both source deletes and membership deletion, rather than only metadata put. It aborts and rejects, so earlier queued work rolls back and no committed notification fires.
- The point success callback contains exceptions from its asynchronous `ready` continuation. A nested failing membership get has already reserved/settled its own failed attempt; the enclosing callback aborts without settling the parent twice. The existing transaction-abort handler returns incomplete failure, and the ledger remains terminal.
- Directly related save/source-scheduling abort cleanup is guarded against a secondary already-aborted/inactive exception. This does not change source operations, outcomes, caps, authority, public interfaces or retry policy. Reset already has a callback catch; its semantics were left unchanged. No global error handler suppresses page errors.

## Red before edits

`red-browser.json` binds the original blobs and records six fresh native Chromium157.0.8103.79 contexts/pages. The three unchanged independent cases are openly labelled **independent-probe replay**, not new independent work:18 assertions,3 expected containment failures. The new C regressions add28 assertions and reproduce the same three uncaught errors while also checking rollback, preserved bytes/membership/revision, successful retry/ordinary use and exact failed-point charging. Focused red total: **46 assertions,6 expected failures,6 externally observed page errors**. Every red synthetic DB was explicitly removed and each owned context closed.

`red-node.txt` and `red-node-receipt.json` retain the new upgrade-callback unit test failing with exit1 on the old source. This uses a narrow open/upgrade double to verify callback/rejection behavior; it is not claimed as native rollback evidence. The other ten storage unit tests pass in that red run.

`independent-probes.original.js` is a byte copy of the reviewer's original. `independent-probes.js` changes only its exact origin guard from5325 to5321. The copied full runner changes only its loopback/probe location and matching module location, retaining all assertions. Original/adapted hashes are in the execution receipt. No independent-review file or result was overwritten.

## Green after correction

- `green-browser.json`: **46/46 focused assertions pass**, zero window/page errors, zero unhandled rejections, six fresh contexts/pages with verified native DB cleanup. The three independent replays are18/18; the C-owned regressions are28/28. Upgrade still rejects and preserves v2/source, delete still rejects and preserves source/member/revision before a successful retry, and failed nested membership still charges exactly four native get attempts. Same-ledger continuation performs no new point or byte work; an explicit new lookup succeeds without repairing missing membership.
- `green-independent-full-replay.json`: **63/63 original reviewer assertions replay successfully**, zero external page errors and no harness errors, ten fresh contexts/twelve pages, all synthetic DB cleanup verified. This covers the unchanged proof identity/selection, missing metadata, MAX, hash/delete race, final-proof abort and notified/silent actual-peer-deletion scenarios. The silent admission still charges its reserved same-ledger second metadata read (32 to33) and rejects changed authority. These63 include the18 already run in the focused replay; they are not another63 distinct independent assertions.
- `targeted-tests.txt`: **28/28** storage/history/coach-storage Node tests pass.
- `full-check.txt`: `npm run check` on this actual child passes **207/207 tests**, TypeScript7.0.2 typecheck and Vite8.3.3 production build, exit0, Node24.21.0. This is the C child source, not root's newer F integration. No lint script is configured and no lint/dependency tool was added.

One initial green attempt is preserved in `green-initial-harness.json` and excluded from acceptance: Vite navigation destroyed the first independent-upgrade context. Its other39 assertions passed, but the missing case/cleanup verification made that attempt incomplete. Its six owned contexts were closed; rerunning the identical runner in six new contexts produced the complete46/46 result above. The root-level Vite scan also warned about unrelated historical prototype imports; it did not alter source or prevent the actual probe modules/checks. These harness observations are not claimed as product defects or benchmark data.

## Isolation, cleanup and limits

Only strict loopback5321 was used; root5301, F5324 and reviewer5325 were untouched. Every production DB name was redirected before any open to a guarded UUID synthetic name. The successful red/green/full suites explicitly remove22 synthetic DBs across22 contexts/24 pages; the excluded harness attempt closes its six additional contexts and records the first context's failed cleanup evaluation honestly. No actual `typeforge` user DB or production migration was exercised. The Playwright-provided default about:blank page was left untouched; only explicitly created test contexts/pages were closed.

`helper-cleanup.json` and `execution-receipt.json` record the exact owned Vite PID39348, command/config/cache, identity verification, termination, port and generated-cache checks. No unrelated listener or process is stopped. Browser request/operation durations are observations, not a controlled performance or heap result. No OS disk-quota exhaustion, crash recovery or broader browser/device/AT claim is made.

Root must import the exact correction and request the independent reviewer's reacceptance. F's separate app admission races, pending-save integration, UX and integrated acceptance remain outside this author follow-up. Runtime/launch settings were preserved; no backend-serving provider/model/effort is inferred from UI/session telemetry, and root retains the launch receipts.
