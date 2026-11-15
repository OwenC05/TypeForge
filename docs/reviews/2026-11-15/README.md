# TypeForge critique round — 15 November 2026

Status: independent Claude design/UX and Codex learning reviews received; ML and engineering reviews remain in progress. This document is a review index, not a completed verdict or implementation approval.

## Objective and scope

Improve everyday typing practice and polish existing features. Assess whether ML makes useful practice decisions, while preserving the distinction between a timing experiment and demonstrated learning gains. Monkeytype is a benchmark for relevant interaction quality, not a mandate to copy its theme or entire feature inventory.

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

These are requested settings, not provider proof. Orca launch receipts and worker-reported runtime evidence are preserved under `.omx/reviews/typeforge-20261115/`; final reporting will distinguish requested from confirmed settings. Coordinator model remains user-selected and unchanged. High effort is assigned to consequential critique; bounded mechanical checks use normal commands without extra model calls.

## Received evidence

- [Independent Claude design/UX review](design-review.md): completed desktop and simulated mobile journeys, returning-user checks, live Monkeytype comparison, current screenshots and reproducible harnesses. Actual Claude model reported as `claude-opus-5-5`; launch receipt requests high effort, applied runtime effort is not independently established. Physical devices, OS IME, screen readers and real browser zoom remain untested. The owned dev server was stopped on completion.
- Initial design findings identify entry-focus friction, misleading no-origin practice-result copy, forgotten preferences, poor active-line placement at narrow widths, and weak practice continuation. These are not yet the reconciled register. Recommendations remain proposals pending cross-domain challenge.
- [Independent learning/product-utility review](learning-review.md): 43 targeted source tests passed; synthetic probes establish assessment-only adaptation and common-pair exposure reversal under the current cadence. These are source/synthetic findings, not real recommendation yield or learning benefits. The report supplies bounded primary research and a staged usability/coverage/retention/transfer evaluation proposal. Runtime argv confirms the Codex client's requested `gpt-6-astra` / `high` configuration; server-side serving identity remains unverified. The initial unsent dispatch recovered through supported Orca messaging and completed successfully.

## Intake evidence

- Authoritative brief: `.omx/context/typeforge-review-handoff-20261115.md`.
- Installed Orca orchestration skill and live `orca skills get orchestration` loaded; runtime 1.4.259 was ready on native Windows. This is an ordinary read-only review run outside tmux, not an OMX autopilot/team invocation.
- Node v24.21.0; npm 11.19.0; default Python 3.11.9. `npm ci --no-audit --no-fund` succeeded, installing the 19 existing packages without a tracked change. Pinned Python environment compatibility remains for ML reviewer to verify.
- No daily-practice decisions matched task-specific AgentMemory retrieval under the original TypeForge project path. The handoff and current code take precedence over historical environment notes.
- Monkeytype's [official repository](https://github.com/monkeytypegame/monkeytype) was accessed at intake. Its README establishes declared scope; live interaction comparison is assigned to Claude and remains pending.

No production deployment, data acquisition, model retraining, new dependencies or application changes are authorized by this critique scope.
