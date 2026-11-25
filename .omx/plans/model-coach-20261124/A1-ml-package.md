A1 ML package: split ml/pipeline.py into tested modules with DVC stages, outputs byte-identical

Read `.omx/plans/model-coach-20261124/common.md` and `plan.md` first. You are worker A1. No port.

## Goal

`ml/pipeline.py` is 454 lines with lines up to about 1,800 characters. It must become a clear, typed, tested package that later tasks extend (eligibility v2, full-archive data, a model ladder), orchestrated by DVC, while reproducing today's outputs exactly. Hiring managers will read this code: optimise for clarity.

## Required changes

1. Split the code into modules directly under `ml/` (for example `config.py`, `acquire.py`, `parse.py`, `dataset.py`, `split.py`, `features.py`, `baselines.py`, `ridge.py`, `evaluate.py`, `export.py`, `cli.py`). Choose the boundaries yourself. Do not create anything named `analysis`, `specs`, `corpus`, `pilot`, `full_archive`, `probes`, `ladder` or `eligibility_v2` (reserved).
2. Keep `python -m ml.pipeline <command> [args]` working with the same commands and flags as a thin shim, so CI, `ml/README.md` and old notes stay valid.
3. Add a data-directory parameter: `--data-dir` and `TYPEFORGE_DATA_DIR`, default `ml/data`. No module may hard-code the data path.
4. Formatting: lines at most 100 characters, type hints on public functions, short docstrings that state contracts (units, ranges, what is excluded). No behaviour change: same eligibility rule, features, splits, seeds, selection, bootstrap, export keys and number formatting.
5. Tests: keep all 21 existing tests passing (moving them into per-module test files is fine). Add focused unit tests for parsing edge cases, split determinism, feature construction, baseline selection and export structure. `python -m unittest discover -s ml/tests -v` must not need DVC, network or the real data.
6. DVC: add stages (acquire, audit, train, evaluate, export) with explicit deps, outs, params (`params.yaml` for seed, alphas, smoothing candidates, history length) and metrics (validation MAE JSON). Pin DVC and its extras in a new `ml/requirements-pipeline.txt` inside your own venv; leave `ml/requirements.txt` unchanged. Local cache only, no remote. Put `dvc.yaml`/`params.yaml` where `dvc repro` works from the repo root, and commit `.dvc/config`, `.dvcignore` and `dvc.lock` after a successful reproduction. The test-split evaluation stays an explicit, separately invoked step, never part of a default `dvc repro`.
7. Update the reproduce section of `ml/README.md` (DVC commands plus the plain CLI equivalent). Do not touch the rest of that README.

## Proving outputs are unchanged

- Copy the original data (`/mnt/c/Users/Owenc/Documents/GitHub/TypeForge/ml/data`, about 259 MB) into your worktree's gitignored `ml/data` and run every stage against the copy. Never write to the original.
- Expected hashes from `ml/experiment.json`: rows `eceba5f1...`, manifest `3a756f95...`, config `83f562c4...`. Reproduce them, the generated `typing-app/client/src/generated/model.json` and `benchmark.json` (equal content; report any field that can legitimately differ, such as timings or environment strings, and how you compared), and `ml/fixtures/parity.json`.
- Re-running the already published test evaluation bit-for-bit is allowed as a regression check. Do not inspect, compute or report any new quantity on the test split.
- Acquisition must not hit the network: verify it against the cached members (the existing resume path) or with a mocked range source in tests.

## Owned paths

`ml/**` except the reserved paths above, `.dvc/**`, `.dvcignore`, `dvc.yaml`, `dvc.lock`, `params.yaml`, and `.gitignore` (only for DVC or venv entries). Do not change client code or the generated JSON; if regeneration differs from the committed files, report it instead of committing new ones.

## Done when

- A table of every derived file with old and new SHA256 (all equal, or each difference explained and approved by the coordinator).
- Test counts before and after; `dvc repro` and `dvc dag` output summarised in your report at `ml/REFACTOR-REPORT.md`.
- Commits on your branch; `worker_done` per common.md. A non-zero exit from tests or a hash mismatch you cannot explain means the task is not done: report it.
