# Independent review of committed ET-1 / ET-2 fixes

Review the committed direct-practice fixes while actual Claude T4 finishes browser/visual evidence. This is a read-only technical delta pass, not final product/design acceptance. Root keeps its selected coordinator model. Requested reviewer is Codex gpt-6.1-sol/high because async save recovery, page lifecycle and prediction state interact.

## Scope and ownership

- Exact review input is commit `71201b7` (resolve and record full hash at startup), including ET-1/ET-2 fix `d67ab6332b61fcece0edf06e53b3291e45177b5c`, visual implementation `39444a5`, and test-only SDK cancellation clarification `71201b7`. Compare against initial technical-review input `21013142e3b920628e4e434470716f3446052580`.
- You are not alone. Claude T4 owns `tf-direct-practice`; the design lead owns visual/UX choices. Work only in your Orca-created isolated `tf-direct-fix-review` worktree. Verify exact input and clean tree. Do not change application/tests, another worktree, root state, processes or branches. No further helper agents.
- Own only `docs/implementation/2026-11-15/direct-practice/review/fix-technical-review.md` and narrow evidence in `review/fix-technical-evidence/`. Commit those files only. Source checks/probes may be authored as evidence; do not fix production code.
- Read root's previous report and final ET-1 contract at `C:/Users/Owenc/orca/workspaces/TypeForge/typeforge-daily-practice/docs/implementation/2026-11-15/direct-practice/review/early-technical-review.md` and `et1-recovery-contract.md`. The original report is commit `e2417c3`. Read matching ui-sdk installed docs/types for any material SDK claim; never inspect compiled SDK implementation or substitute a different SDK.

## Work in three small parts

1. **ET-1 async lifecycle and loss prevention:** inspect the new UnsavedResults helper and actual finish/restart/setting/anchor handlers. Verify immutable payload identity, pending/failed/permanent-rejected records, multiple/out-of-order saves, per-entry single flight, Retry/Export/Discard and explicit cross-document departure, with no new response mirror or router. Confirm existing stale/disposed guards remain effective through every newly chained callback. Use meaningful focused source/real-engine probes and existing tests; distinguish fake-host evidence from browser execution.
2. **ET-2 and SDK boundaries:** confirm per-engine/sentence preparation prevents duplicate/after-edit attachment across no-op edits, actual input, late history, next sentence and restarts; optional rejection remains harmless. Check the new bridge-open agent assertion matches the documented SDK event/cancellation contract and cannot fabricate successful human typing. Review changed native input/focus semantics for correctness, without visual/taste judgments.
3. **Evidence and remaining checks:** inspect added unsaved/continuation regressions for realistic call sequencing and missing races; run the smallest useful existing checks locally. No browser captures, visual review, performance measurements or resource-contention-sensitive browser runs while T4 owns those. No new dependencies except the existing locked npm ci if needed. Record exact test count and source, not merely historical 129/129 from T4.

## Specific leads from root's initial diff read (hypotheses, not findings)

- In app.ts, the retry button adds `.then(() => { if ($('#retry-save').hidden) afterResultRendered(); })` after attemptSave. Probe delayed retry followed by Again/setting restart/page disposal: does this new continuation bypass generation/disposed checks, query a removed button, touch a replacement result or steal focus?
- The carried-recovery line is inert while the engine runs, but a deliberate in-app navigation is intercepted and then attempts to focus Export in that line. Probe this state after continuing with an older unsaved result. Are the documented explicit departure/export actions actually usable at that point?
- The save catch sets a record to failed and notifies before classifying permanent validation rejection, and returns early on a stale generation. Check classification/retry semantics after a pending save becomes permanently rejected following continuation.
- The commit message says retry checks for an existing saved copy before writing; implementation appears to check exists after a write error. Determine the actual guarantee and material consequence without inventing a race or treating documentation mismatch alone as data loss.
- Export tracking, retained entries and pending settlement should match the final recovery contract and not silently discard another result. Do not expand into new persistence or unlimited feature work.

Confirm or dismiss each with source/probe evidence. Do not mirror root's suspicions as findings without analysis. Rank any actual defects with exact line, trigger, consequence and smallest bounded fix. Report whether ET-1 and ET-2 are closed for this exact source, still blocked, or need named evidence. Report strengths and limitations; green tests alone do not close a reproduced defect.

## Completion

Commit report/evidence, then worker_done to root with exact hash, reviewed commit, commands/results and open blockers. A successfully delivered review may contain blockers; use a truthful subject. T4 fixes all source and Claude lead makes final visual/interaction decisions. Later commits require a delta check; this pass does not accept unfinished browser/geometry/zoom/performance evidence or later source. Preserve Portfolio/original checkout. No push/deploy, accounts, hidden cleanup, unsafe recursive deletion, terminal steering or user approval ritual.
