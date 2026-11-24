# Coordination record: model-coach phase

Run `run_0e7c9914d0b7`. Integration branch `feature/daily-practice`, fast-forwarded to `origin/main` (`9b2a660`), plan commit `6ce7e02`. Every worker: Codex `gpt-6.2-astra`, effort `max` (as Owen asked), Orca child worktree based on `6ce7e02`.

| Task | Orca task | Dispatch | Worktree | Port | Start receipt |
| --- | --- | --- | --- | --- | --- |
| A1 ML package and DVC | task_a31573af295b | ctx_29f9c1290eec | tf-ml-package | none | ready |
| A2 Eligibility v2 | task_8ad8a0ad1416 | ctx_f01ea5522e93 | tf-eligibility-v2 | none | outcome_unknown (start not yet observed; do not resend) |
| A3 Banks v2 | task_21e3896acb82 | ctx_7d2ef6c21875 | tf-corpus-v2 | none | ready |
| A4 P3 fixes | task_e4aa32b4ad6c | ctx_c715b5f40c42 | tf-p3-fixes | 5341 | ready |
| A5 Docs and archive | task_ea9056268472 | ctx_97d6b3cf822b | tf-docs-archive | 5342 | outcome_unknown (start not yet observed; do not resend) |
| A6 Lab monitoring | task_c9541edd1a94 | ctx_147176221fa3 | tf-lab-monitoring | 5343 | stopped under D9 before starting |
| A7 Pilot design | task_40d788fa6bad | ctx_4568829433ef | tf-pilot-design | none | ready |
| A8 Full archive | task_fcab7828747b | ctx_2a767ea5a907 | tf-full-archive | none | ready |
| A9 Cross-browser | task_aa1e5a4caecd | not started | (after A4 is integrated) | 5344 | waits on A4 |

## Integration order

A4 first (A9 depends on it), then A6 (both touch `app.ts`), A1, A2, A3, A7, A8 in arrival order, A5 last among docs changes because it deletes the receipts and rewrites links. Each branch is reviewed before merging: diff scope against the brief's owned paths, the worker's checks rerun where cheap, UI screenshots reviewed by the coordinator.

## Log

- 24 Nov: run, tasks and eight workers started.
- 24 Nov: Owen questioned DVC. Dropped from A1 (`msg_2ff62e4f119c` to `ctx_29f9c1290eec`): no DVC files or references; the module split, data-dir parameter, tests and byte-identity proof stay. The A1 brief file keeps its original text as the dispatched record; this message supersedes its DVC items.
- 24 Nov: found A2, A3, A4, A5, A6, A7 and A8 idle at an empty Codex prompt with zero tokens: their task text never reached the agent despite `ready` receipts (`input_accepted`, activity idle). Only A1 had started. Resent each task once as a self-contained message pointing at its brief, with its task, dispatch and terminal IDs and the lean changes (A2 `msg_8418d28ce6dd`, A3 `msg_83ca9bf86d91`, A4 `msg_aaee0205579a`, A5 `msg_8c64c87de80f`, A7 `msg_d95ee8c9e946`, A8 `msg_74d3b8f46355`). All six then showed activity `working`.
- 24 Nov: Owen asked to keep the project lean (plan D9). A6 stopped before it started (`worker-stop`, terminal closed); monitoring moves into C1. Scope trims for A3, A5 and A7 are in their messages. Lesson for later starts: check `worker-read` shortly after `worker-start`, because a `ready` receipt does not prove the agent received its task.
