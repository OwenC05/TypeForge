# TypeForge critique round — 15 November 2026

Status: all four independent reviews received, plus actual Claude's live Keybr comparison, benefit challenge and clarifications. Sequential Architect and Critic approved the revision-3 roadmap; the configured quality-gate list is empty. [Final planning receipt](../../../.omx/plans/typeforge-planning-receipt.json). This review does not authorize implementation.

## Objective and scope

Improve everyday typing practice and polish existing features, with UI/UX a primary product objective. Assess whether ML makes useful practice decisions, while preserving the distinction between a timing experiment and demonstrated learning gains. Monkeytype and Keybr are references for concrete interaction and practice journeys, not a mandate to copy their themes or feature inventories.

Review target: `feature/daily-practice` at `de69444a6201da96281ca9ad88088904477775a2` in `C:/Users/Owenc/orca/workspaces/TypeForge/typeforge-daily-practice`. The source checkout was clean at intake. The original checkout and Portfolio are excluded. Application implementation is deferred until the critique, challenge and roadmap are available.

## Review plan and acceptance

1. Independent Orca workers inspect design/UX, ML/evaluation, learning usefulness, and engineering. Actual Claude owns design judgments. Each report distinguishes runtime observations, source findings, inference and untested hypotheses, with confidence and evidence.
2. Review evidence includes fresh source references, safe checks, current screenshots at representative widths, an exercised typing journey and explicit platform/test limitations. Historical reports are leads to recheck.
3. Coordinator reconciles overlapping or conflicting findings into one severity-ranked register. Focused independent challenge tests the recommendations before the roadmap is finalized; design recommendations receive Claude review.
4. Final roadmap prioritizes immediate defects/polish, a useful daily-practice vertical slice, then ML/learning experiments. Each item includes user value, acceptance criteria, dependencies, effort and uncertainty. Only genuinely unresolved product decisions go to Owen.

Completion requires the independent reports, Monkeytype journey comparison, current data/model/practice/feedback map, reconciled findings, challenge disposition and prioritized roadmap. Passing a build is not product acceptance or evidence of typing improvement.

## Independent lanes

| Lane | Requested provider/model/effort | Evidence/report ownership |
| --- | --- | --- |
| UI/UX/design | Claude `claude-opus-5-5`, high | `design-review.md`, `design-evidence/`; isolated browser and Vite dev port 5187 |
| ML/data/evaluation | Codex `gpt-6-astra`, high | `ml-review.md`, `ml-evidence/`; bounded offline checks |
| Typing improvement/daily usefulness | Codex `gpt-6-astra`, high | `learning-review.md`, `learning-evidence/`; source and primary research |
| Engineering/reliability/accessibility/privacy/performance | Codex `gpt-6.1-sol`, high | `engineering-review.md`, `engineering-evidence/`; build, tests and isolated preview port 5188 |

These are requested settings, not provider proof. Actual Claude's session reports `claude-opus-5-5`; applied effort is unknown. ML and learning runtime argv confirms the Codex client configuration `gpt-6-astra` / `high`, not the server's serving identity. Engineering's launch requests `gpt-6.1-sol` / `high`; actual backend and applied effort remain unverified. Orca routing receipts remain under `.omx/reviews/typeforge-20261115/`, with relevant provenance in each tracked report. Coordinator model remains user-selected and unchanged. High effort was assigned to consequential critique; bounded mechanical checks use commands without extra model calls.

## Received evidence

- [Independent Claude design/UX review](design-review.md): completed desktop and simulated mobile journeys, returning-user checks, live Monkeytype comparison, current screenshots and reproducible harnesses. Actual Claude model reported as `claude-opus-5-5`; launch receipt requests high effort, applied runtime effort is not independently established. Physical devices, OS IME, screen readers and real browser zoom remain untested. The owned dev server was stopped on completion.
- Design findings identify entry-focus friction, misleading no-origin practice-result copy, forgotten preferences, poor active-line placement at narrow widths, and weak practice continuation. The reconciled register corrects the initial Progress claim: practice records appear in history, but lack a useful activity summary.
- [Independent learning/product-utility review](learning-review.md): 43 targeted source tests passed; synthetic probes establish assessment-only adaptation and common-pair exposure reversal under the current cadence. These are source/synthetic findings, not real recommendation yield or learning benefits. The report supplies bounded primary research and a staged usability/coverage/retention/transfer evaluation proposal. Runtime argv confirms the Codex client's requested `gpt-6-astra` / `high` configuration; server-side serving identity remains unverified. The initial unsent dispatch recovered through supported Orca messaging and completed successfully.
- [Independent engineering review](engineering-review.md): full client check 94/97 pass with three CRLF-sensitive test-harness failures; separate typecheck/build and production-build browser regression 39/39 pass. Native Undo invalidates diagnostics; a constrained-CPU input probe and unbounded history path justify bounded follow-up. Live JS/CSS matched local built bytes, without establishing deployment SHA or all-route parity. Owned preview stopped on completion.
- [Independent ML review](ml-review.md): 21/21 model/profile client tests pass; Python 19/21 pass with two missing-sklearn errors outside the pinned environment. Ridge predicts in-browser but does not select focus; uniform-timing roundoff can create a false focus; heuristic configuration depends on the candidate artifact. Public-data timing accuracy is not evidence of better practice decisions or learning.
- [Claude Keybr comparison and benefit challenge](../../../.omx/plans/typeforge-claude-benefit-review.md): fresh live flows, screenshots, four scripted lessons and visible letter unlock; no human learning claim. [Clarifications](../../../.omx/plans/typeforge-claude-clarifications.md) supersede ambiguous wrapping/cue/status proposals and correct the original plan-hash receipt.

The test subsets overlap and must not be added together. Real screen reader/IME, physical devices, Firefox/Safari and actual browser zoom remain unverified.

## Integrated planning artifacts

- [Review synthesis and expected benefits](../../../.omx/plans/typeforge-review-synthesis.md).
- [Ranked findings and reconciliation](../../../.omx/plans/typeforge-reconciled-findings.md).
- [Prioritized roadmap and acceptance criteria](../../../.omx/plans/prd-typeforge-review-breakdown.md).
- [Verification specification](../../../.omx/plans/test-spec-typeforge-review-breakdown.md).
- [Architect approval](../../../.omx/plans/typeforge-architect-review-3.md) and [subsequent Critic approval](../../../.omx/plans/typeforge-critic-review-3.md). Reviewed plan headers retain their authored pre-approval status to preserve exact bytes; the receipt records the later verdicts.

All changes in this round are review/planning evidence. Application source remains at the reviewed base; commits are local on `feature/daily-practice`.

## Intake evidence

- Authoritative brief: `.omx/context/typeforge-review-handoff-20261115.md`.
- Installed Orca orchestration skill and live `orca skills get orchestration` loaded; runtime 1.4.259 was ready on native Windows. This is an ordinary read-only review run outside tmux, not an OMX autopilot/team invocation.
- Node v24.21.0; npm 11.19.0; default Python 3.11.9. `npm ci --no-audit --no-fund` succeeded, installing the 19 existing packages without a tracked change. Pinned Python environment compatibility remains for ML reviewer to verify.
- No daily-practice decisions matched task-specific AgentMemory retrieval under the original TypeForge project path. The handoff and current code take precedence over historical environment notes.
- Monkeytype's [official repository](https://github.com/monkeytypegame/monkeytype) was accessed at intake; actual Claude subsequently exercised live Monkeytype and [Keybr](https://www.keybr.com/) journeys. Their declared features are distinguished from tested behavior in the reports.

No production deployment, data acquisition, model retraining, new dependencies or application changes are authorized by this critique scope.
