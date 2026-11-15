# E1 bounded execution plan

Owner: E1 child, Task `task_c414281b2e3a`, Dispatch `ctx_42d3bb53acd2`, parent Task `task_ab1851d93138`, Run `run_af59e2a95b3a`.
Starting HEAD: `01fa86d8172a0e65f1df89e50064570285e6c48e`.

1. E1.1: install only locked child-worktree dependencies, capture original `npm run check` failure (expected 94/97), byte hash and line endings. Evidence precedes test edits.
2. E1.2: normalize app source in the test harness and validate extraction boundaries before VM evaluation; keep all existing restart/calibration/retest/assessment-from assertions. Add focused LF/CRLF and missing/reversed-boundary regressions. Own only app.test.ts, necessary test helpers and this directory; no production behavior changes.
3. E1.3: run full checks and separate typecheck/build against temporary LF and CRLF app-source bytes with restoration in finally; capture exit codes, test counts and restart assertion execution. Verify original source hash, review owned diff and commit completed owned files.

Mandatory handoff constraints apply: no further helpers, runtime-state writes, terminal polling/steering, run-use, global config/API/dependency changes, UI/design/copy, Undo/metrics/schema, model/baseline/policy, push/deploy or original-workspace resources. Actual Claude required if design scope emerges; escalate instead. No browser/server is needed here; lead owns browser review. Existing Python/browser/scientific limitations remain. Every nonzero validation is failure except explicitly recorded pre-fix baseline evidence or existing ML-04-negative evidence.

Requested model `gpt-6.1-sol`, effort `medium`; observed process/client configuration will be recorded separately, without backend identity claims or effort inference from numeric telemetry.
