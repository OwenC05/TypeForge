# Coordination record: model-coach phase

Run `run_0e7c9914d0b7`. Integration branch `feature/daily-practice`, fast-forwarded to `origin/main` (`9b2a660`), plan commit `6ce7e02`. Every worker: Codex `gpt-6.2-astra`, effort `max` (as Owen asked), Orca child worktree based on `6ce7e02`.

| Task | Orca task | Dispatch | Worktree | Port | Start receipt |
| --- | --- | --- | --- | --- | --- |
| A1 ML package and DVC | task_a31573af295b | ctx_29f9c1290eec | tf-ml-package | none | ready |
| A2 Eligibility v2 | task_8ad8a0ad1416 | ctx_f01ea5522e93 | tf-eligibility-v2 | none | outcome_unknown (start not yet observed; do not resend) |
| A3 Banks v2 | task_21e3896acb82 | ctx_7d2ef6c21875 | tf-corpus-v2 | none | ready |
| A4 P3 fixes | task_e4aa32b4ad6c | ctx_c715b5f40c42 | tf-p3-fixes | 5341 | ready |
| A5 Docs and archive | task_ea9056268472 | ctx_97d6b3cf822b | tf-docs-archive | 5342 | outcome_unknown (start not yet observed; do not resend) |
| A6 Lab monitoring | task_c9541edd1a94 | ctx_147176221fa3 | tf-lab-monitoring | 5343 | ready |
| A7 Pilot design | task_40d788fa6bad | ctx_4568829433ef | tf-pilot-design | none | ready |
| A8 Full archive | task_fcab7828747b | ctx_2a767ea5a907 | tf-full-archive | none | ready |
| A9 Cross-browser | task_aa1e5a4caecd | not started | (after A4 is integrated) | 5344 | waits on A4 |

## Integration order

A4 first (A9 depends on it), then A6 (both touch `app.ts`), A1, A2, A3, A7, A8 in arrival order, A5 last among docs changes because it deletes the receipts and rewrites links. Each branch is reviewed before merging: diff scope against the brief's owned paths, the worker's checks rerun where cheap, UI screenshots reviewed by the coordinator.

## Log

- 24 Nov: run, tasks and eight workers started.
