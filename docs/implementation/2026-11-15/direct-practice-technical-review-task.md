# Early independent technical review of direct practice

Root-owned Orca review while the actual Claude design lead is unavailable because of its provider usage limit. This is a bounded initial T5 pass, not final acceptance or a replacement for Claude implementation/design review.

## Frozen input and ownership

- Review exact commit `21013142e3b920628e4e434470716f3446052580` of `OwenC05/tf-direct-practice` against root's verified foundation `c8a479f624f19f5079f8b73d9ad12093a040e52a`. Start in an Orca-created isolated worktree at the exact input. Verify HEAD before work. Do not move the checkout to newer revisions.
- You are not alone. T4 Claude still owns its source workspace and has uncommitted app/style/evidence changes. Never edit, build in, clean up, commit, switch branches or stop processes in that workspace. Do not read its changing files as if they belong to the frozen review. Never touch Portfolio or the original checkout.
- Own only `docs/implementation/2026-11-15/direct-practice/review/early-technical-review.md` and narrowly necessary evidence below `review/early-technical-evidence/` in your own worktree. Application source and tests are read-only. Report fixes upward rather than implementing them.
- Use installed Orca orchestration and the current task/dispatch report protocol. No helper workers are needed for this bounded review. Model requested: gpt-6.1-sol, high effort, because native input, storage and SDK source separation interact. Record requested versus observed client/provider receipts without inventing backend effort.

## Three small review slices

1. **Ready practice, settings and persistence correctness.** Trace clean/default and remembered visits, URL/origin/remembered precedence, malformed and unavailable storage, assessment isolation, route cleanup and stale async work. Confirm accepted first native input starts/counts once, optional history does not delay General practice, late predictions stay frozen after any edit, restart and in-place results retain lineage/save-failure protections. Assess implementation correctness against the established contract, not visual taste.
2. **SDK and native event boundaries.** Review the matching installed core/web integration, safe imports, control event lifecycle and cleanup, createAgent wiring, user/agent-origin handling, disabled controls, and focus/keyboard semantics as correctness and accessibility issues. Agent actions must not synthesize human timing. Read version-matched installed docs/types for any material SDK claim; do not inspect compiled SDK implementation or substitute another SDK. No new dependencies except locked npm ci in your isolated worktree if needed for verification.
3. **Tests and evidence honesty.** Inspect changed source-extraction assertions, preferences regressions and browser/agent harnesses. Check that intended in-place navigation/settings updates do not remove essential assertions. Run the smallest useful existing checks in your isolated worktree. Do not perform visual design critique, new screenshot production, browser/performance runs or resource-contention-sensitive measurements. The Claude state/geometry/zoom/performance evidence is incomplete and excluded; identify necessary final verification without declaring it passed.

## Evidence and completion

Read the committed direction/inspection, ui-sdk/feasibility.md, tests and root foundation reports for the actual contracts. The newer user instruction is no landing page, default 30-second General practice immediately; preserve native editing and existing scoring. No framework migration, schema/model/corpus/scoring rewrite or scientific learning claim.

Findings must include severity, exact file and line, trigger, observed or inferred consequence, reproduction/evidence and recommended bounded fix. Distinguish confirmed blockers, unresolved questions and missing final evidence. Report strengths when verified. Do not invent findings to fill a quota, and do not mistake the unfinished validation state for a proven product defect.

Commit the report/evidence only and report through worker_done to root. A successful review deliverable may contain blockers: make that explicit in the subject and report. Report exact reviewed commit, commands/results and limits. The design lead will consume this pass and review only later source changes plus unresolved findings after T4 settles; no claim that this frozen pass covers later dirty or committed changes. No push/deploy, credentials, provider switch, account/credit change, unsafe scratch cleanup or process/terminal steering.
