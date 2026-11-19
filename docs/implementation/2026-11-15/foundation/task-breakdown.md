# Foundation wave task breakdown

Source application baseline: `de69444a6201da96281ca9ad88088904477775a2`.
Integration input: `a991cfad31b410928e4894fa875e8161438354c5`, including reviewed-plan commit `45d2da7` and execution handoff.
Lead Task `task_ab1851d93138`, Dispatch `ctx_446d65c5fee5`, Run `run_af59e2a95b3a`.

Purpose: restore trustworthy Windows test execution and prevent numerical noise from selecting a practice focus. Stop after these repairs, independent technical review, combined verification and a concrete report to root.

| Task | Owner and allowed writes | Dependencies | Acceptance and evidence |
| --- | --- | --- | --- |
| E1.1 preserve baseline | E1 Codex child; app.test.ts, narrowly necessary test helper; foundation/e1/ evidence | This decomposition committed | Capture original 94/97 failure, identify extraction failures before assertions |
| E1.2 repair extraction | Same E1 child | E1.1 | Normalize LF/CRLF; reject absent/reversed markers; retain actual restart assertions; no framework |
| E1.3 verify both encodings | Same E1 child | E1.2 | Execute all existing assertions and new boundary regressions from LF and CRLF app-source variants; npm run check/type/build; restore source bytes |
| ML.1 preserve reproduction | ML Codex child; profile.ts, profile.test.ts, narrowly justified pure helper; foundation/ml04/ evidence | This decomposition committed | Reproduce constant-200-ms actual engine false focus; preserve synthetic limitations |
| ML.2 numerical repair | Same ML child | ML.1 | Explain floating-point error over supported log/count bounds; abstain for uniform data/orders; retain clearly larger differences; preserve baseline packaging |
| ML.3 targeted verification | Same ML child | ML.2 | Run profile/model regressions, actual engine/order permutations, type/build; full suite's pre-existing E1 failures remain explicit until integration |
| I.1 review/integration | Foundation lead; the source/test areas above and foundation/ docs | E1 and ML commits/evidence | Inspect both diffs and commits, integrate only reviewed owned changes; cross-review children after their implementation tasks settle |
| I.2 combined checks | Foundation lead | I.1 | npm run check and separate typecheck; all tests execute; LF/CRLF checks if needed to close child evidence gaps |
| I.3 browser restart/lineage | Foundation lead; foundation/browser/ scripts/evidence | I.2 | Documented isolated Playwright MCP filename runner, committed typing-flow harness with port-only copy at owned strict port 5197; failed=0, errors=[]; add bounded restart/lineage cases if the committed harness lacks them |
| I.4 final receipt/cleanup | Foundation lead; foundation/ docs | Reviews and checks pass | Exact source/commit sequence, files, Task/Dispatch and requested vs observed model/effort; close only owned helpers, report limitations |

Children run in Orca-created isolated child worktrees from this decomposition commit. At most two immediate children are active. They own separate dependencies/build trees and start no browser servers; the lead owns browser port 5197 after checking it is unused. Requested E1 model `gpt-6.1-sol`, effort `medium`; ML model `gpt-6.1-sol`, effort `high`. Both identifiers/levels are advertised in the current local Codex models cache; dispatch/argv receipts will be recorded separately from unverified backend identity.

Mandatory descendant constraints: read `.omx/plans/typeforge-execution-handoff-20261115.md` first, approved PRD Stage 1A/test specification V0/V6/final planning receipt and relevant E1/ML-04 review evidence. Load orchestration SKILL.md and live guide. Use assigned Run/parent Task; never run run-use, poll/steer terminals or write raw runtime state. No further fan-out. Preserve others' work; commit only owned files, no force/reset/clean. Actual Claude is mandatory for design work, which is excluded here. No app.ts rendering edits, Undo repair, schema/metrics changes, scientific minimum-effect policy, baseline repackaging, model training/promotion, dependencies/APIs/global tooling, push/deploy, paid work or data upload. Preserve native selection/composition, old results/predictions, strict input bounds/cohorts and prediction prohibition after any edit. Keep helpers hidden and clean up only owned resources. Every nonzero required verification is failure unless explicitly captured as a pre-fix baseline; do not relabel errors as passes.

Existing review limits remain: Python had 19 pass/2 missing-sklearn errors; browser uses accelerated time and does not certify OS input/IME, AT, other engines/devices/zoom, scientific benefit, human yield or deployed commit parity. E3 profiling is optional evidence-only and will be skipped unless needed after the required repairs.
