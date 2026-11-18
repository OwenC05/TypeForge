# Combined baseline/practice integration evidence

Root integrated corrected F app/General prompt identity and C callback containment at production-source commit **bc7a885**. Fresh combined checks pass **235/235 Node tests, TypeScript typecheck and Vite production build**, followed by **120/120 production-browser assertions**, zero page/console errors. Independent C correction acceptance and actual-Claude F UI acceptance remain pending; this report does not promote author evidence into independent review or claim learning benefit/deployment readiness.

## Inputs and verification

`combined-browser-provenance.json` records17 exact production/package/runner inputs and33 generated build files, including raw SHA256 and source Git blobs. The production diff from bc7a885 is empty after the run. Key blobs:

| Input | Git blob |
| --- | --- |
| app.ts | 9353263540cef3a29d22af63780819916d6106a9 |
| storage.ts | a46a0a62eed07507ca0c2b4c0f23ce41c8cb1036 |
| coach-storage.ts | 07371e38c33de1531e40440102c688fb31581bdf |
| coach-policy.ts | a3868390989d6b8e84e370ee125fdfd3c19c0cce |
| unsaved.ts | c41408080e1d6563bc9c2f021fbeb3ab28acca8e |

`combined-cf-check.txt` is the fresh root full-check receipt. No lint script is configured; no new lint or runtime dependency was added. Earlier234-test F-only root result is preserved in `ui-fallback-check.txt`, not conflated with the combined235 result.

The browser run is an explicitly labelled **replay of F's existing real production-flow oracle on the newly combined source**, not120 newly independent assertions. `coach-combined-replay.mjs` is a byte copy of source runner blob `244f357756f3755d7f6afa5595b1631b799e43da` with only executable `const PORT = 5324;` changed to5302. Historical comments and the cleanup assertion's static label still say5324; actual BASE, server arguments, receipt and independent port check all use5302. Only the `real` phase ran; relocated relative paths for other phases are not used. Existing installed Playwright-core1.64.0-alpha-1790635538000 and Chrome157.0.8103.79 were used without package installation.

The real phase uses native browser typing into the actual bundled app, real C/D/E, fresh guarded UUID synthetic databases and a paused scripted clock. It exercises immediate General, baseline progression through ten durable tests, interrupted/failed-save/retry/Again/reload states, actual Suggested admission and finite ends, context mismatch actions, Progress/summary/history/export, reset, peer invalidation and honest fallback. Captures and mechanical overflow/slot checks cover1440x900,390x844,320x640, with selected forced-colour/reduced-motion emulation. These are supplied test assertions and captures, not root design judgments; actual Claude independently owns visual/UX acceptance. Race-hold/fallback-specific author dev-server evidence remains separately labelled in the F report.

Results: `combined-browser/real-flows.json`, `combined-browser/real-helper-receipt.json`, `combined-browser-run.txt`, and `combined-browser/screens/`. The saved result explicitly reports120 passes, zero failures, empty errors and base `http://127.0.0.1:5302`.

## Integrated writer and recovery inventory

Root searched every production source file for IndexedDB opens/transactions and inspected final app/recovery call sites. Only storage.ts opens/upgrades the evidence DB; direct transactions are confined to storage.ts/coach-storage.ts. Outside the exclusive versionchange bootstrap, all shipped source mutations are C's saveSource, deleteSource and resetEpoch, each using the shared four-store readwrite scope. Other direct transactions are read-only. No raw app/unsaved write path, import/repair writer or source overwrite was added.

App completion calls saveSource with the frozen record's original capture; UnsavedResults receives that same function and retries original source/capture. It has no exists(id)-only success shortcut. Both timed and finite result Delete controls call deleteResult, which delegates to C deleteSource; Progress reset calls resetEpoch. Legacy saveResult delegates to C with null capture. In-memory Set/Map deletes are not storage writers. This closes the F call-site inventory left outside the independent C source pin; actual transactions/rollback/proof reacceptance remain the independent C lane's responsibility.

## Isolation, cleanup and limits

Root replay spawned hidden Node PID72460 with exact cwd `typing-app/client`, `vite preview --host127.0.0.1 --port5302 --strictPort`, windowsHide=true and no shell. Its receipt reports serverExited/portClosed; root freshly verified PID absence and no5302 listener. Fresh temporary browser contexts closed with the owned browser; guarded synthetic-name assertions passed. The existing root preview PID28552/port5301 was identity-checked and left intact. No author/reviewer helper, real user DB, original checkout, Portfolio, global configuration, paid service, upload, push or deployment was touched.

No OS disk-quota/crash-recovery, other browser engine, physical device/IME, real screenreader, browser zoom, wall-clock latency/heap guarantee or measured typing improvement is claimed. Ten saved baseline tests is the product milestone; recommendation support still independently determines whether Suggested has a focus. Final verdict depends on the two remaining independent reviews; material new corrections require only affected rechecks and an updated source pin.
