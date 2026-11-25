# TypeForge timing models

TypeForge fits two timing models offline on public Aalto keystrokes and runs them in the browser. L5 chooses a pair for Suggested practice. Ridge and its historical baseline predict individual keystroke intervals for the comparison on saved results.

## L5 practice coach

L5 estimates the expected time for each letter pair at a typist’s speed, adjusted for the mix of pairs they typed. It then estimates a personal gap for each pair. Sparse observations shrink the gap toward zero.

Of 134,975 training assignments in the full Aalto 136M archive, 93,478 typists supplied a clean sentence. The model fit used 7,950,952 intervals from exact, unedited copies on full-size and laptop QWERTY keyboards. An eligible interval is the time between successive key presses for adjacent lowercase letters within a word. It must be positive and at most 5,000 ms.

The registered fresh test held out 16,659 typists and excluded the 2,000 from the earlier Ridge experiment. Predictions used the first half of each typist’s trials to estimate mean log timing in the second half. A pair needed two observations in each half. Across 4,240 scored typists and 13,906 qualifying typist–pair combinations, mean absolute error was **0.204 log ms** for L5 and **0.288** for the typist’s own earlier average. The paired 95% participant-bootstrap interval for the reduction was **0.079–0.088 log ms**. The registration required at least 800 scored typists and a lower endpoint above 0.020 log ms.

The fit check counts how often a pair’s observed mean falls inside its predicted 80% range, using up to 20 recently checked sentences. From eight checked sentences, coverage below 70% returns Suggested to General. The threshold came from the second percentile of 803 validation typists with enough checks (70.38%, rounded down). It stopped suggestions for 15 of those 803.

L5 can choose pairs for TypeForge and for a prospective practice trial. Its training speed range is about 32–150 WPM. Beyond it, L5 uses the nearest supported pair pattern and the typist’s observed pace. Few fast typists qualified for scoring. Whether training the suggested pairs improves typing on fresh text awaits the trial. [Registration](coach/PREREG.md) · [Independent review](coach/REVIEW.md) · [Results and fit calibration](coach/REPORT.md)

## Reproduce

To reproduce the Ridge experiment, run from the repository root with Python 3.14. The scientific packages are pinned in
`ml/requirements.txt`. The published config also records the interpreter build string.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r ml/requirements.txt
.venv/bin/python -m unittest discover -s ml/tests -v

.venv/bin/python -m ml.pipeline acquire --participants 2000 --seed 42 --max-bytes 268435456
.venv/bin/python -m ml.pipeline audit
export OPENBLAS_NUM_THREADS=16  # The published training hashes depend on this thread count.
.venv/bin/python -m ml.pipeline train
```

Training freezes the validation choices in `ml/experiment.json`. Run the following steps
explicitly to reproduce the published test evaluation and browser artifacts.

```sh
.venv/bin/python -m ml.pipeline evaluate --split test
.venv/bin/python -m ml.pipeline export
```

On Windows the interpreter is `.venv/Scripts/python.exe`. If Python lacks `ensurepip`,
install its matching venv package before creating the environment. For a local ZIP, add
`--source /path/to/Keystrokes.zip` to `acquire`. The source path is part of the manifest.
Use a separate data directory for a different source. CI runs the offline tests.

All stages use `ml/data/` by default. Set `TYPEFORGE_DATA_DIR=/path/to/copy` in the
environment for a whole run, or pass `--data-dir /path/to/copy` to a single command.
The flag takes precedence and works before or after the command name. This directory
holds the raw TSVs, manifest, derived rows, audit, frozen config, private evaluation
keys, evaluation and stage timings. The published registration, browser JSON and
synthetic `ml/fixtures/parity.json` are written to their usual repository paths.

Member hashes cover the original bytes. Structured hashes cover UTF-8 JSON with sorted
keys and compact separators. The exported benchmark contains aggregate results only.
The exact interpreter build and artifact hashes are in the [reproduction report](REFACTOR-REPORT.md).

## Full-archive coach dataset

Run from the checkout in WSL with the pinned interpreter. The historical cache supplies its acquisition manifest and the source WPM metadata.

```sh
TF_SOURCE=/mnt/c/Users/Owenc/Documents/GitHub/TypeForge
TF_ARCHIVE=/home/owenc/typeforge-data/aalto-136m
OPENBLAS_NUM_THREADS=1 "$TF_SOURCE/.venv/bin/python" -m ml.pipeline dataset-v2 \
  --data-dir "$TF_ARCHIVE" --prior-data-dir "$TF_SOURCE/ml/data"
```

`$TF_ARCHIVE/dataset-v2/{train,validation}.npz` contains the following aligned NumPy columns. Load with `np.load(path, allow_pickle=False)`. All indices are zero-based.

| Rows | Columns |
| --- | --- |
| Interval | `interval_typist`, `interval_trial_order`, `interval_pair` (aa=0 through zz=675), `interval_position` (second letter in target), `interval_log_ms` (float64 natural log of press-to-press ms). |
| Trial | `trial_typist`, `trial_order` (minimum press time, then lexical source section ID), `trial_sentence` indexes `sentences`, `trial_reason` indexes `reason_labels`. Label 0 is the empty string for A2's null reason. |
| Typist | `typist_index` indexes the split's A8 `ids.txt`, `typist_trials_replayed`, `typist_trials_eligible` (null reason, including clean trials with zero pairs), `typist_avg_wpm_15` (source WPM for reporting bands only). |

`validation-corrected.npz` has the same interval columns for A2's nine-stroke window on each side. Its trial keys join to `validation.npz`.
`meta.json` records the rule, commit, input and output digests, exclusions and historical cross-check. Rerunning at the same commit replays both partitions and compares all four files byte for byte.

## Source and acquisition

[Aalto 136M keystrokes](https://userinterfaces.aalto.fi/136Mkeystrokes/) / [source ZIP](https://userinterfaces.aalto.fi/136Mkeystrokes/data/Keystrokes.zip), **non-commercial use with attribution**. Cite the source project and its paper, *Observations on Typing from 136 Million Keystrokes*, Dhakal, Feit, Kristensson and Oulasvirta (CHI 2018). Data terms differ from the recording-code license.

Acquisition discovers the ZIP64 directory from its footer, never hard-codes offsets, then fetches only metadata/readme plus exactly 2,000 stable SHA256(seed:member)-ordered participant files. Each HTTP range is checked for exact Content-Range, size and unchanged ETag. Uncompressed members are bounded at 32 MiB each and 1 GiB in total, verified by archive CRC32, and recorded with SHA256. Interrupted acquisition resumes from CRC-verified cached members. A transfer cap applies per acquisition invocation (including directory overhead); retries can incur additional transport bytes. It never silently substitutes a reduced dataset. TSVs fail on truncated/oversized rows; malformed or invalid-UTF8 participant files are excluded in full and counted, never repaired by guessing keystrokes.

Eligibility: actual metadata `LAYOUT=qwerty`, physical `KEYBOARD_TYPE=full|laptop`; exact final copy, reconstructable one-character event sequence with only SHIFT ignored, strictly increasing printable-key timestamps. Correct-copy intervals use 0 < press-to-press ≤5,000 ms for adjacent lowercase letters within maximal `[A-Za-z]+` words. Space/punctuation/case boundaries never bridge. Public data lacks repeat/composition/focus flags: reconstructability is **not proof of identical first-pass browser instrumentation**. Exclusion and speed/error coverage are reported. Full-session metadata statistics never enter predictive features.

## Locked experiment

Participant assignment: Rank acquired participants by SHA256(seed:split:ID), then assign exact 70/15/15 disjoint train/validation/test groups before eligibility. Actual post-exclusion counts are reported. Independently reserve 20% of normalized prompt hashes. Reserved prompts never enter fit, tune **or any calibration history**. Features use only the participant's latest ten earlier eligible nonreserved sentences. Earlier test-participant nonreserved trials may calibrate later trials; reserved trials never do.

682 features: lexical `pair_aa`…`pair_zz`, word length, relative second-letter position, user mean-log-ms, log1p(user count), pair mean-log-ms, log1p(pair count). Missing pair mean falls back to user mean, missing user mean to train-only population mean. Sparse `StandardScaler(with_mean=False)` + Ridge `lsqr`; alpha candidates 0.1/1/10/100. The no-history ablation retains only pair/context (678 features). Population, user and smoothed-pair (k=1/5/20) baselines and model hyperparameters are selected by **validation participant-macro millisecond MAE**, never test error.

`train` freezes config/defaults/model coefficients and validation residual q10/q90 before the explicit `evaluate --split test` unlock. `ml/experiment.json` publishes the frozen estimand, selected baseline/alpha and config/input hashes; evaluation refuses a mismatched registration. Subsequent changed training config is rejected once test evaluation exists. A changed experiment requires a new untouched holdout for any promotion claim; deleting evaluation files does not scientifically erase prior inspection.

The primary estimand is test participants / nonreserved prompts / warm history participant-macro MAE, with full-Ridge-minus-frozen-baseline paired participant bootstrap (seed 42, 2,000 replicates, percentile 95% interval). Secondary slices are disjoint nonreserved-cold, reserved-warm and reserved-cold observations. Empty slices are unavailable, never zero; one participant gets a descriptive point estimate but no interval. Actual train prompt overlap is reported: “seen” means partition membership, not guaranteed training occurrence. Ranking requires ≥8 observations per pair and ≥5 qualifying pairs; sparse participants are excluded explicitly. A validation residual interval describes individual transition variation, not confidence in a pair average or expected practice benefit.

## Browser contract

`typing-app/client/src/generated/model.json` has exactly the keys frozen in `.omx/plans/prd-recruiter-platform.md`: artifact/feature/model versions, experimental status, English/QWERTY task, 682 feature names/coefficients, intercept, population default, baseline identity/config, residual bounds and source/config/manifest/report provenance. Scaling folds **coefficient / scale only**; the intercept is unchanged. `benchmark.json` is linked by model/report versions and includes environment, hashes, aggregate audit, all validation choices and held-out slices.

`fixtures/parity.json` uses `{synthetic,modelVersion,cases:[{prompt,history,occurrences:[{position,pair,features,predictedLogMs,predictedMs}]}]}`. Expected fixture predictions are captured from the original fitted estimator/scaler before coefficient folding, then export independently checks their agreement. `transitionFixture` provides an increasing synthetic event stream, retained observations and expected advanced history. Browser/Python tolerance is relative 1e-6. Cold and warm mixed-case/apostrophe inputs cover fallback and word-position semantics. No inference library or remote prediction API is required.

The Ridge benchmark measures prediction error on Aalto typing. Differences in browser instrumentation and text can affect how well those estimates transfer to TypeForge.
