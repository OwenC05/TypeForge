# E1 normalized-empty handler review fix

**Completed bounded implementation; lead review/integration remain.** Task `task_f58772f6866f`, Dispatch `ctx_6f990e6a0214`, worker `term_bdea906e507035d1d02081fb8d067fd4`, coordinator `term_90062000-9957-4002-8f66-49467c40954b`; same foundation Run `run_af59e2a95b3a` and parent Task `task_ab1851d93138`. Source base `0dfecbd2b05ed724f746cd0d4a5f73ab399e421d`. This independent E1 child does not contain the lead's ML04 repair.

The expressly requested `orca orchestration check` delivered the continuation for this exact task. Read `aebd757:docs/implementation/2026-11-15/foundation/ml04/e1-review.md`: the MEDIUM blocker correctly distinguishes raw boundary ordering from normalized body emptiness. `plan.md` was written before editing; original handoff, ownership and previously loaded orchestration skill/live guide remain applicable. No further helpers or orchestration/runtime-state mutation.

## Minimal change and regression proof

Only `typing-app/client/tests/app.test.ts` changed outside this new evidence directory. The helper keeps every existing marker/order guard, trims the extracted source, removes its optional trailing semicolon, trims again, then explicitly asserts `handler.length > 0` before returning it for any parser/VM use. This rejects the exact normalized-empty gap without moving or weakening any existing restart behavior assertions. No unrelated extraction refactor or product change.

Four new tests cover whitespace-only and semicolon-only slices under LF and CRLF. Each includes a second whitespace-only line, so the CRLF fixtures contain actual CRLF bytes rather than merely changing a fixture label. Tests call only `restartHandler` inside `assert.throws`, expecting the specific nonempty-after-normalization diagnostic; parser/VM rejection cannot satisfy them.

Before changing the helper, command `node --experimental-strip-types --test --test-name-pattern 'normalized-empty' tests/app.test.ts` ran from `typing-app/client`: **expected pre-fix exit 1, four tests, zero passes, four failures**, all `Missing expected exception` (`pre-fix-regressions.txt`). The same command after the guard: **exit 0, four passes, zero failures** (`post-fix-regressions.txt`). This is preserved failing-regression evidence, not relabelled green.

## Encoding, full-suite and assertion evidence

Fresh reproducible command from workspace root:

```powershell
node docs/implementation/2026-11-15/foundation/e1/review-fix/verify-encodings.mjs 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js'
```

The copied evidence runner changes only its relative client path for this deeper evidence directory. Its sibling assertion preload is copied unchanged. It writes fresh logs here, never historical E1 snapshots. Node children use direct executable invocation with windowsHide=true and shell=false. For each actual app.ts LF/CRLF source copy, the runner executes full `npm run check`, separate `npm run typecheck`, separate `npm run build`, and an assertion-instrumented run of the three original restart tests; every subprocess's status must equal zero. Source bytes are restored in `finally` even on failure. The runner exited **0**.

| Validation | LF | CRLF |
| --- | --- | --- |
| Full check (tests plus chained typecheck/build) | exit 0; 106/106, zero failures | exit 0; 106/106, zero failures |
| Separate typecheck | exit 0 | exit 0 |
| Separate build | exit 0 | exit 0 |
| Original restart tests | exit 0; 3/3 | exit 0; 3/3 |
| Observed restart assertion calls | 73 unchanged original + 12 helper guards = 85 | 73 unchanged original + 12 helper guards = 85 |

Counts here are **102 pre-existing child tests + four new negative regressions = 106**, not the lead's previous integrated 106-test suite. The lead's ML04 tests are absent from this child; integration must freshly verify the resulting combined suite rather than reuse either 106 count.

The evidence preload delegates to the real assertion methods and records calls by test-file line. Original assertion-body calls retain their previous breakdown (22 calibration/focus/stopped/disposed, 24 retest-origin, 27 assessment-from/practice-from/retest = 73). Four helper guard calls per selected test produce 12 additional calls, up from the historical nine. The original source assertion bodies are unchanged in Git diff. Counts are executed method calls, not a claim of full branch coverage or total suite assertions; passing test results establish their successful completion.

`encoding-results.json` records original 809 CRLFs, LF copy zero CRLFs, all eight subprocess exits zero, and restoredExactBytes=true. Original/restored app.ts SHA256 is `9a06967c04e9dcb00288f71ae5e4baac31a1e3fe080ca95a665f619571ef0f3e`; LF-copy SHA256 is `352467fad24fd27c3be8aba86adce742ba2c50d41db505e102848b96897cfaf9`. A separate post-run Get-FileHash matched, and `git diff --quiet -- typing-app/client/src/app.ts` exited 0. No production source change remains.

## Model receipt, scope and cleanup

Requested model `gpt-6.1-sol`, effort `medium`. Current sanitized process query found only matching resumed worker PID **2504**, parent **31276**, with this terminal/worktree and `resume 01a1e034-0958-74a2-ae27-1c3172fc8c7d`; the current argv contains no explicit model or effort flags (`client-process.json`). Accordingly current applied client model/effort and backend identity are **unverified**. Historical earlier-launch receipts remain unchanged and are not promoted to proof for this resumed process; no inference from numeric telemetry or global config change was made.

No dependency install/update, browser/server, port use, helpers, design/visual judgment, global tooling, other-workspace/branch mutation, Undo/metrics/schema/baseline/policy changes, push or deployment. Existing child-local ignored dependencies/build outputs remain; synchronous test/build children exited. The only expected nonzero validation was the four pre-fix regression failures. Logs captured through PowerShell were saved as UTF-8 with trailing formatting whitespace trimmed; statuses/messages retained. All original evidence snapshots remain unchanged. Staged whitespace and ownership checks must pass before the owned-only commit.

Lead independently reviews/integrates and reruns combined checks. No browser rerun was needed for this test-only correction; earlier browser/OS input/IME/AT/other-engine/device/zoom, scientific-benefit and deployment-provenance limitations remain. Historical Python 19 pass/two missing-sklearn errors and npm audit findings are neither retested nor resolved. The original E1 review's normalized-empty blocker is addressed by the new explicit guard and four failing-then-passing fixtures, subject to lead acceptance.
