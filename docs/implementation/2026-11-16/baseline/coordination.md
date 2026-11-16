# Baseline phase coordination

16 November 2026. Run `run_1aeb00550f39`; application baseline b3fb14c, initial committed plan/task briefs through c65460b. Root remains the integration owner with its user-selected coordinator model. Previous direct-practice run remains separate and completed; do not reopen old workers for unrelated work.

## Initial launch receipts

| Lane | Task | Dispatch | Agent / configured model / effort | Workspace | Receipt state |
|---|---|---|---|---|---|
| P1 Baseline/policy | task_dad9dc52ce84 | ctx_cbc26b52dc79 | Codex / gpt-6.1-sol / high | tf-baseline-policy | ready |
| P2 UX | task_15d7fb65c018 | ctx_188d78feb5e3 | actual Claude / claude-opus-5-5 / high | tf-baseline-ux | ready |
| P3 Reliability | task_1d858a48cbb2 | ctx_e33d53491b92 | Codex / gpt-6.1-sol / high | tf-baseline-reliability | ready |
| P4 Release checks | task_08e5d0d508f0 | ctx_8e8d2efe1568 | Codex / gpt-6.1-sol / medium | tf-baseline-release | ready |

These are actual Orca dispatch/configuration receipts, not proof that a backend applied an effort value or that work has completed. Each is an Orca-created child workspace of the current TypeForge workspace, based on feature/daily-practice; no manual checkouts or global model changes. Worker-start command sessions were resumed only to receive their original result; no uncertain start was duplicated.

Each lead has the small-task breakdown, ownership, shared constraints, helper-delegation instruction and output contract in worker-common/task files. Peer dispatch contacts and resource boundaries were delivered as `msg_486c24406b3d`, `msg_834bfcebf385`, `msg_cb4bd892d311`, `msg_166b348f81da`. P1/P2 reconcile policy and UX; P3 can implement additive bounded storage concurrently; P4 records reproducible release risks. No production adaptive policy or new UI is authorized before those contracts are reconciled and independently reviewed.

Root preview `127.0.0.1:5301` remains reserved and untouched. Suggested worker ports 5312/5313/5314 require strict availability checks; they are not permission to stop an existing listener. Worker profiles/builds remain isolated; timing claims require uncontended measurement. Portfolio and the original TypeForge checkout remain outside scope.

## Next integration steps

Consume worker reports through Orca wake messages, not polling. Reconcile baseline count/duration and evidence eligibility separately; freeze the policy/UX/storage interfaces, arrange independent architecture and critical review, then assign the pure policy/sampler and actual-Claude UI integration lanes. Any metricVersion/Undo change stays separately reviewed. Keep General/manual available regardless of calibration state and preserve frozen assessment meaning. Update this record with helper graphs, commits, verification and any genuine blockers as evidence arrives.
