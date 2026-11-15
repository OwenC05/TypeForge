# E1.1–E1.3 harness repair

Completed 15 November 2026 in isolated `typeforge-foundation-e1`, starting HEAD `01fa86d8172a0e65f1df89e50064570285e6c48e` (application baseline `de69444a6201da96281ca9ad88088904477775a2`). Task `task_c414281b2e3a`, Dispatch `ctx_42d3bb53acd2`, parent Task `task_ab1851d93138`, parent terminal `term_90062000-9957-4002-8f66-49467c40954b`, Run `run_af59e2a95b3a`.

## Change and bounded scope

`typing-app/client/tests/app.test.ts` normalizes loaded app-source CRLF to LF. Its shared restart extraction checks the start and end markers exist, rejects reversed/empty boundaries before TypeScript parsing/VM evaluation, and replaces the three repeated unchecked restart slices. Every existing behavioral assertion remains unchanged. Five new tests execute multiline LF/CRLF fixture handlers and reject missing start, missing end, reversed and empty boundaries. No framework, production behavior, dependency manifest/lock, design, copy, UI, metrics, lineage policy, Undo or model policy changed.

The task breakdown was written in `plan.md` before editing tests. Handoff, approved PRD Stage 1A, V0/V6, final planning receipt, engineering E1 report/diagnostic and installed orchestration skill/live guide were read. The historical planning-only receipt is superseded for this bounded execution by the execution handoff and dispatched task. No further workers, run-use, terminal polling/steering or runtime-state mutations were used.

## Reproduction and validation

Commands below ran only in this child worktree. Node `v24.21.0`; npm `11.19.0` (package command banner/version verified in prior engineering evidence; current installation command used local npm). `npm ci` installed the existing lockfile: exit 0, 19 packages; npm reported two high-severity audit findings. No audit fix or package changes were made.

| Command / evidence | Result |
| --- | --- |
| Pre-fix `npm run check` from client; `baseline-check.txt` | Expected pre-fix failure, exit 1: 94 pass / 3 fail / 97 tests; all three restart extraction cases fail before their behavioral assertions |
| `git ls-files --eol typing-app/client/src/app.ts typing-app/client/tests/app.test.ts` | Both index LF / original working copy CRLF; app source has 809 CRLFs |
| Initial repaired `npm run check`; `repaired-check.txt` | Exit 0: 102 pass / 0 fail, including all 97 existing tests; chained typecheck/build pass |
| `node docs/implementation/2026-11-15/foundation/e1/verify-encodings.mjs 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js'` | Final exit 0; `encoding-results.json`, per-encoding check/typecheck/build logs |
| LF source copy: full check, separate typecheck, separate build | Each exit 0; 102/102 tests, 0 failures |
| CRLF source copy: full check, separate typecheck, separate build | Each exit 0; 102/102 tests, 0 failures |
| Instrumented original restart tests, both encodings | Each exit 0: 3/3 tests; 73 original assertion calls plus 9 new boundary assertion calls per encoding |
| `git diff --check` | Exit 0 |

`verify-encodings.mjs` writes only app.ts encoding variants and this evidence directory. It captures commands, exits, source hashes and line endings, and byte-restores the original source in `finally`, including on failure. Final original/restored SHA256: `9a06967c04e9dcb00288f71ae5e4baac31a1e3fe080ca95a665f619571ef0f3e`. LF copy SHA256: `352467fad24fd27c3be8aba86adce742ba2c50d41db505e102848b96897cfaf9`. Production source has no Git diff.

The separate evidence-only `count-assertions.mjs` preload delegates to every original assertion implementation and counts calls by app.test.ts caller line; the ordinary full checks do not preload it. The selected original test names and per-line tallies appear in `LF-restart-assertions.txt` and `CRLF-restart-assertions.txt`. Existing executed assertions comprise 22 calls for fresh calibration/focus/stopped-state/disposed continuation, 24 for deleted/incompatible/unreadable/abandoned retest origins, and 27 for assessment-from/practice-from/retest across changed/restored settings. These are executed assertion-method calls, not a claim about total assertions in the 102-test suite.

## Failed helper attempts and recovery

The initial encoding verification failed at LF restart instrumentation, exit 1, because Windows Node `--import` requires a file URL rather than an absolute drive path. `initial-instrumentation-failure.json` and `.txt` preserve that failed run; LF check/typecheck/build had passed, CRLF had not run, and original source bytes were restored. Only the evidence runner was corrected to supply `.href`; the complete LF/CRLF verification then passed freshly. This failed attempt is not counted as a pass.

A read attempted the nonexistent `typing-app/package.json`; the actual package is `typing-app/client/package.json`, which was read next. An optional one-line Node tally command lost quoting through Windows PowerShell and exited 1 before running; the tally was recomputed with PowerShell JSON parsing (82 total, 73 original calls per encoding). Neither command was application validation, and neither result is presented as green.

## Requested versus observed model/effort

Requested: Codex `gpt-6.1-sol`, `medium`. `client-process.json` records only the matching worker process: PID 12460, parent PID 26916, Codex executable, this terminal/worktree configuration, and argv `-m gpt-6.1-sol -c model_reasoning_effort=medium`. This confirms client launch configuration, not backend serving identity or applied inference effort. No effort was inferred from numeric telemetry and no global model/config changes were made.

## Gaps, cleanup and lead integration

Independent review and native browser restart/lineage checks belong to the foundation lead's integration tasks, not this no-browser child. No browser or server was started, no shared ports/processes or original/root workspace were touched, and no background helper remains. Synchronous Node build/test children exited; ignored child-local node_modules/dist remain for review, and neither is committed. Only this report/evidence/scripts/plan and app.test.ts are owned changes; no dependency tree, runtime state or browser profile is included.

No lint script exists. Python was not run; historical 19 pass / 2 missing-sklearn errors remain unresolved. Browser accelerated-clock, OS input/IME, screen-reader, Firefox/Safari, physical device/zoom, human learning, deployment identity and scientific-benefit limitations remain. This repair proves the source-sliced harness executes; it does not establish browser correctness or a product behavior fix. Lead reviews and integrates the bounded commit; no push or deployment is authorized or performed.
