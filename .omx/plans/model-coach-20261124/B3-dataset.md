B3 Full-archive datasets built with A2's rule

Read `.omx/plans/model-coach-20261124/common.md` and `plan.md` first, especially "The model", D2, D10 and D11. You are worker B3. No port. Python runs in WSL with the pinned venv (`/mnt/c/Users/Owenc/Documents/GitHub/TypeForge/.venv/bin/python`, read-only), with `OPENBLAS_NUM_THREADS=1`.

## Why

B4 fits and compares coaching models on the full Aalto archive. It needs every eligible interval from the training and validation typists, measured by the same rule the browser applies, in a form it can load in seconds.

## Inputs (read-only)

- A8's shards in `/home/owenc/typeforge-data/aalto-136m/ingest-v1/` (manifest SHA256 `ddb00d980b28ea2653b15d27010df051a23f37ce197d78228b175027d8fd528c`). The schema is in `ml/full_archive/REPORT.md`, under "Using the shards". Open only `train/` and `validation/`. Never open `test/` or `legacy_test/`, not even to count.
- A2's rule: `ml/eligibility_v2.py` (`eligible(replay_aalto(rows, layout=..., keyboard_type=...))`), specified in `ml/specs/eligibility-v2.md`.
- A1's package conventions: `ml/cli.py`, `--data-dir` and `ml/config.py`.

## Steps

1. Add one stage to the ML package: a module plus a CLI subcommand. It replays every train and validation trial through A2's adapter. Per split, it writes one compressed NPZ under `/home/owenc/typeforge-data/aalto-136m/dataset-v2/`, outside git, containing:
   - per interval: typist index, trial order within the typist (chronological, as A8's report describes), pair index (26 × 26 lowercase), position in the sentence and log milliseconds;
   - per typist: index into the split's `ids.txt`, trials replayed, trials eligible, and the source `AVG_WPM_15` (used only to group typists into reporting bands);
   - per trial: typist index, trial order, A2's sentence-level reason code and the target sentence (or an index into a table of distinct sentences), so B4 can rebuild the frozen Ridge's features;
   - `meta.json`: rule version, input manifest SHA256, split manifest SHA256, code commit, counts and rejections by reason.
2. For validation typists only, also write the intervals from corrected sentences that A2's widest window admits (9 strokes either side of a correction; see `ml/analysis/eligibility_v2_bias.py`). Put them in a separate file with the same per-interval columns. B4 uses them for the D2 comparison. Reuse A2's code for the window. If that needs more than a small refactor of A2's module, ask me first.
3. Determinism: two runs must produce byte-identical files. Use at most six processes.
4. Cross-check: the 1,700 historical development typists (now in train) must reproduce A2's 100,906 v2 intervals. Unit tests use tiny synthetic shards only; no real data goes into git.
5. Document the build command, output location and schema in a short section of `ml/README.md`, at most about 25 lines. Your report goes under the gitignored `artifacts/`. It holds counts by split and WPM band (typists, intervals, median intervals per typist, typists with at least 50 and at least 200), runtime and the cross-check.

## Owned paths

The new dataset module, the new subcommand in `ml/cli.py`, `ml/tests/test_dataset_v2.py` and the new section of `ml/README.md`. Data stay outside git.

## Done when

Both splits are built twice with identical bytes, the cross-check matches, `python -m unittest discover -s ml/tests` passes, and `worker_done` follows `common.md`. Put the dataset paths and their SHA256s in the `worker_done` body, because B4 starts from them.
