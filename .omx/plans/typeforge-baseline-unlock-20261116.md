# Baseline unlock and useful personalized practice

16 November 2026. Ordinary authorized execution with a bounded policy/design prerequisite. Orca run `run_1aeb00550f39`. Coordinator model stays unchanged. Application baseline: `b3fb14c` on `feature/daily-practice`; direct-practice implementation accepted at `db56cf0`, integrated in `3f9a98d`. This plan extends the approved earlier roadmap; it does not reactivate completed Ralplan.

## Goal and latest decision

Owen likes the current UI and approves the next-step proposal: reliability work, a defined coaching policy, practice affecting the next block, and understandable progress. His new candidate is roughly ten baseline tests before personalized practice unlocks. Break the work into small subtasks and parallelize independent work through Orca.

Working interpretation: the baseline gates personalized practice only. `/` continues to offer immediate General practice, manual practice remains available, and no landing page or mandatory account is introduced. Calibration should be resumable across visits. Ten is a candidate product target to evaluate, not an evidence-backed scientific threshold. The policy and Claude flow must distinguish baseline completion from having enough evidence for a particular recommendation; no unsupported weakness is invented to reward completing a counter.

## Current evidence and implications

- `src/profile.ts:28-31` selects the newest ten eligible submitted assessment **sentences**, not ten completed tests. Practice does not contribute. Preserve existing assessment calibration while designing a separate practice policy.
- `src/profile.ts:61-85` selects focus using support, corpus coverage and a baseline score. The completed numerical repair suppresses roundoff-only targets; it does not establish meaningful learning need.
- `src/profile.ts:89-110` uses a two-target/one-general drill cadence. Earlier R06 evidence shows enrichment can fail for common pairs; the new policy must test actual delivered opportunities.
- `src/storage.ts:294-338` limits returned valid results, not examined corrupt rows or bytes. `src/app.ts:944-959` limits today's summary to five such pages, while Progress at `1154` still loads lifetime history. A new optional profile needs genuinely bounded reads.
- `src/engine.ts:68-69,460-461` and `src/storage.ts:101` retain schema/metric version 1. Undo changes require the separate reviewed instrument contract, not a silent semantic change.
- `direct-practice/root-integration.md` records the accepted UI, 132 tests and exact build verification, plus remaining browser/AT, input, performance and dependency limits.

Short source paths above are under `typing-app/client/`. Earlier substantive specifications remain `.omx/plans/prd-typeforge-review-breakdown.md` Stage 1C, 1D, 2A and 2B, and its test specification. Newer no-landing/direct-practice decisions override the older UI proposals.

## Parallel work and ownership

| Lane | Small parts and deliverable | Ownership | Initial model/effort |
|---|---|---|---|
| P1 Baseline/policy | Define countable tests; compare approximately ten short assessments with evidence readiness; probe coverage/repeats/compatibility; choose one conservative signal; specify unlock/abstention/retirement, independently versioned coach config and fixtures | `.omx/specs/typeforge-practice-policy-v1.md` and `docs/implementation/2026-11-16/baseline/policy/`; no production app changes yet | Codex `gpt-6.1-sol`, high |
| P2 Calibration UX | Actual Claude designs entry/resume/progress/unlock/insufficient-evidence/reset states in the accepted visual system, with first-visit/return/keyboard/narrow flows and a reviewable local prototype | `docs/implementation/2026-11-16/baseline/ux/`; no shared app/style edits until contract integration | Claude `claude-opus-5-5`, high |
| P3 Reliability foundation | Implement/test additive bounded history access; specify lifecycle integration; independently decompose native Undo/Redo and metric migration before changing semantics | `src/storage.ts`, new non-UI history module/tests if justified; `docs/implementation/2026-11-16/baseline/reliability/`; app/engine/schema changes deferred | Codex `gpt-6.1-sol`, high |
| P4 Release checks | Recheck two dependency advisories and actual applicability; exercise available browser engines and keyboard/edit recovery; report accessibility evidence versus untested AT; identify minimal follow-ups | `docs/implementation/2026-11-16/baseline/release/` and isolated verification scripts only | Codex `gpt-6.1-sol`, medium; escalate for reproduced complexity |

Each lead must split its lane into workable tasks and use `$orchestration` for independent helpers where that improves throughput. Give each helper a specific output, file lease, prerequisite, stop condition and actual provider/model/effort. Actual Claude owns any design/visual/UX judgment. Avoid duplicate full audits and workers competing for the same source, browser, build directory or timing measurement. One level of bounded helpers is sufficient unless a concrete dependency warrants more; report the graph and receipts to root. Do not infer provider settings from a prompt label.

## Dependencies and next execution stages

1. Start P1-P4 independently in Orca-created child workspaces. P3 can implement the already-specified storage foundation while P1/P2 define the adaptive product. P4 records findings; dependency changes require a focused follow-up based on actual advisories.
2. Reconcile P1/P2 into one concrete contract. Independent architecture/critique checks cover eligibility, migration, deletion/reset, scan completeness, privacy, sample-count versus confidence and fallback. Root resolves ordinary tradeoffs from user intent; ask Owen only about a materially unresolved product choice. This is a technical review checkpoint, not a routine permission handoff.
3. Freeze interfaces and split implementation: pure profile/policy/sampler logic; actual Claude UI integration; history lifecycle integration. One owner of `app.ts`/`style.css`. Connect complete practice results to the next block only, preserve active snapshots and compatible assessment history. Undo/Redo stays a separate versioned lane if it can be implemented without conflicting with that contract.
4. Independent technical and actual-Claude acceptance, then root integration, focused tests/typecheck/build and exact-source browser verification. Preserve user changes, record commits and update findings with evidence. No deployment is included.

## Acceptance criteria

- A clean first visit is still ready to type General without setup; personalization never blocks it.
- The baseline contract states one concrete test target/duration and counting rules, with justification/limits. Ordinary mistakes do not silently make progress impossible. Interrupted, incompatible, repeated, corrupt or deleted evidence has an explicit outcome.
- Progress can resume across visits using valid local source records and policy identity. Test boundary cases at zero, one, target-minus-one, target and target-plus-one, as well as reload/reset/deletion and late read results.
- Baseline completion and per-target evidence sufficiency are separate states. Ten empty/duplicated/unsupported runs cannot manufacture a supported target. If no focus is justified, General remains useful with an understandable reason.
- Personalization uses exactly the reviewed signal, thresholds, windows, context and policy identity. Missing Ridge does not invalidate a separately valid coach; invalid coach config never fabricates a suggestion.
- Practice can update the next recommendation and retire/change a target under specified rules. Running text/settings/predictions never change from late history or a later deletion.
- Suggested practice meets its declared target exposure and context-diversity rule, including short/partial runs; otherwise it falls back or is labelled honestly.
- Local profile scans obey the Stage 1C examined-row/byte budgets and return completion/cursor/diagnostics; incomplete scans cannot present exact totals or supported diagnoses.
- Existing result validation, export, source deletion, keyboard-native editing and unsaved recovery remain covered. Assessment cohorts and historical metric meanings remain intact.
- The user can explain what baseline progress means, why a suggestion appears and how to continue General; actual Claude reviews these states. Human usability and learning benefit remain separate unverified claims.

## Risks and verification

Ten tests may create friction or still give sparse evidence; evaluate cumulative duration and support, allow pause/return, and do not label the number scientifically optimal. Repeated small corpora can give familiarity instead of coverage; measure passage/context repetition and preserve protected assessment boundaries. Multiple users/keyboards in a browser are not identities; specify local reset/context handling. New derived state must not survive deletion incorrectly or contaminate frozen assessment history. Memory, timing and privacy limits are explicitly tested rather than hidden behind a passing build.

Keep the local accepted preview on 5301 untouched. Worker browsers use distinct profiles and strict ports; helpers are hidden. Portfolio and the original checkout stay isolated. No new accounts, data uploads, telemetry, paid credits, model training/promotion, broad dependency upgrades, push or deployment. Existing user skill/config changes remain unstaged.
