# Coordination record: model-coach phase

Run `run_0e7c9914d0b7`. Integration branch `feature/daily-practice`, fast-forwarded to `origin/main` (`9b2a660`), plan commit `6ce7e02`. Every worker: Codex `gpt-6.2-astra`, effort `max` (as Owen asked), Orca child worktree based on `6ce7e02`.

| Task | Orca task | Dispatch | Worktree | Port | Status |
| --- | --- | --- | --- | --- | --- |
| A1 ML package | task_a31573af295b | ctx_29f9c1290eec | tf-ml-package | none | merged `4647361`, released |
| A2 Eligibility v2 | task_8ad8a0ad1416 | ctx_f01ea5522e93 | tf-eligibility-v2 | none | merged `dd8f511`, released |
| A3 Banks v2 | task_21e3896acb82 | ctx_7d2ef6c21875 | tf-corpus-v2 | none | merged `e368808`, released |
| A4 P3 fixes | task_e4aa32b4ad6c (+ follow-up task_d4038d3a8a2d) | ctx_c715b5f40c42, ctx_e4392aed43d8 | tf-p3-fixes | 5341 | merged `38ef2e7` and `48e605c`, released |
| A5 Docs and archive | task_ea9056268472 | ctx_97d6b3cf822b | tf-docs-archive | 5342 | merged `45d287b`, released |
| A6 Lab monitoring | task_c9541edd1a94 | ctx_147176221fa3 | tf-lab-monitoring | 5343 | stopped under D9, released |
| A7 Pilot design | task_40d788fa6bad | ctx_4568829433ef | tf-pilot-design | none | merged `0a90c53`, released |
| A8 Full archive | task_fcab7828747b | ctx_2a767ea5a907 | tf-full-archive | none | merged `60637d1`, released |
| A9 Cross-browser | task_aa1e5a4caecd | ctx_8a087a9119cb | tf-cross-browser | 5344 | running from `38ef2e7` |
| B3 Datasets | task_42fe9e205137 | ctx_fe1a1418d232 | tf-dataset-v2 | none | merged `adde405`, released |
| B4 Coach model | task_29999e85584d | ctx_d6b50b445b79 | tf-coach-model | none | running from `245c9fb`; B3 paths and hashes sent (`msg_a49c3eea1153`) |
| B7 Banks in app | not created | | | 5345 | starts after A9 merges |

## Integration order

A4 first (A9 depends on it), then A6 (both touch `app.ts`), A1, A2, A3, A7, A8 in arrival order, A5 last among docs changes because it deletes the receipts and rewrites links. Each branch is reviewed before merging: diff scope against the brief's owned paths, the worker's checks rerun where cheap, UI screenshots reviewed by the coordinator.

## Log

- 24 Nov: run, tasks and eight workers started.
- 24 Nov: Owen questioned DVC. Dropped from A1 (`msg_2ff62e4f119c` to `ctx_29f9c1290eec`): no DVC files or references; the module split, data-dir parameter, tests and byte-identity proof stay. The A1 brief file keeps its original text as the dispatched record; this message supersedes its DVC items.
- 24 Nov: found A2, A3, A4, A5, A6, A7 and A8 idle at an empty Codex prompt with zero tokens: their task text never reached the agent despite `ready` receipts (`input_accepted`, activity idle). Only A1 had started. Resent each task once as a self-contained message pointing at its brief, with its task, dispatch and terminal IDs and the lean changes (A2 `msg_8418d28ce6dd`, A3 `msg_83ca9bf86d91`, A4 `msg_aaee0205579a`, A5 `msg_8c64c87de80f`, A7 `msg_d95ee8c9e946`, A8 `msg_74d3b8f46355`). All six then showed activity `working`.
- 24 Nov: Owen asked to keep the project lean (plan D9). A6 stopped before it started (`worker-stop`, terminal closed); monitoring moves into C1. Scope trims for A3, A5 and A7 are in their messages. Lesson for later starts: check `worker-read` shortly after `worker-start`, because a `ready` receipt does not prove the agent received its task.
- 24 Nov, A1 question `msg_ff58ed39c1c4`: refactored and original trainers match at one OpenBLAS thread (config a06e6eec...), but the published 83f562c4... depends on thread count. Approved one `train` at 16 threads with affinity capped to six cores, then the published evaluation only if the hash matches; otherwise stop, since the one-thread equality proves the refactor. Fresh timings may differ. Record the thread-count dependence in the README.
- 24 Nov, A5 question `msg_fbfa86dd6e83`: `tests/coach-plan.test.ts` and `tests/coach-policy.test.ts` read archived receipts at runtime. Approved moving only the asserted data into `tests/fixtures/` with unchanged assertions, plus a repo-wide grep for other runtime references.
- 24 Nov, merged after review: A5 `45d287b` (screenshots reviewed), A1 `4647361` (all published hashes reproduce at 16 OpenBLAS threads), A7 `0a90c53`, A4 `38ef2e7` (fix traced: the fallback selects General for the current block only; the next block re-reads the Suggested choice from the URL), A2 `dd8f511`, A8 `60637d1` (split manifest holds hashes and counts only, no IDs), A3 `e368808` (tone reviewed from random samples of both banks), A4 follow-up `48e605c` (dispatch `ctx_e4392aed43d8`: race and fallback phases now assert the new first-key contract). Checks on the merged branch: client 236/236 with typecheck and build; `ml/tests` 42/42; `ml.full_archive.test_ingest` passes.
- 24 Nov: A9 started from `38ef2e7` (dispatch `ctx_8a087a9119cb`, terminal `term_ccc22c45-972e-413f-a9b6-19e262c4d4f8`, worktree `tf-cross-browser`). Self-contained additions sent (`msg_8ba128480660`): configurable port, leave race/fallback alone, matching browser builds. `worker-read` confirmed it working.
- 24 Nov: A2 kept the clean-copy rule (D2 revised), which the browser engine already applies (`engine.ts`: any wrong character flags `incorrect`, any Backspace or non-tail edit flags `edited`, and either discards the sentence's pairs). B1 merged into B3, B2 dropped, engine parity moved to C2 (D11). A8's coverage ends near 150 WPM, against Owen's 190 (D10).
- 24 Nov: `ml/corpus/test_banks.py` raises `SystemExit` without the cached source export, aborting the runner instead of skipping; fix assigned to B7. B7 starts after A9 merges, because both edit `tests/browser/coach-app.mjs` and B7 is off the critical path.
- 24 Nov: released A1, A2, A3, A4, A5, A6, A7 and A8 workers. Phase A worktrees remain on disk until Owen's review.
- 24 Nov: B3 and B4 started from `245c9fb`. Both sat at a blank prompt with zero tokens again. Resent as self-contained messages (B3 `msg_4d23be258f91`, B4 `msg_16f91e376a93`). B4 picked its message up; B3 needed a typed nudge (`orca terminal send ... --enter`) before it read its mail. Both working.
- 24 Nov: B3 merged (`adde405`) after review: only train and validation shards are read; two builds byte-identical; the 1,700 historical typists reproduce 100,906 intervals; 44/44 Python tests. Train 7.95M intervals over 93,478 typists (median 42), validation 0.98M over 11,500; fastest typist with a clean interval 152.6 WPM; 120+ WPM band has 120 train and 17 validation typists. Paths and SHA256s sent to B4 (`msg_a49c3eea1153`); B3 released.
