C1c Calibrate the coach's fit check on validation typists

Read `.omx/plans/model-coach-20261124/common.md` and `plan.md` first, especially D12 and D13. You are worker C1c. You need no port. Python runs in WSL as `common.md` describes, with `OPENBLAS_NUM_THREADS=1`.

WSL is currently unreliable. A startup timeout (`Wsl/Service/0x8007274c`) never reaches Python, so wait 30 s and launch again, up to 10 times.

Owen's direction: keep TypeForge lean. Build only what this brief needs.

## Why

C1b is putting the L5 coach into the app with a fit check, a guard against typists the model does not describe. The check works like this:

- **When it fires.** If the model's 80% ranges cover too few of a typist's recent pair timings, the coach stops suggesting and Suggested runs General.
- **Why its threshold matters.**
  - Set too high, it blocks typical typists.
  - Set too low, it never fires.
  - Its definition must also give sensible coverage at the single-sentence level, which the registered validation never measured: that scored half-session means.
- **Owen's case.** He types about 190 WPM, beyond the model's speed support. For him the check decides whether suggestions appear at all.

Validation typists are the tuning set. The fresh and legacy test sets stay closed.

## The check

C1b implements this same definition in TypeScript.

- **Evidence.** A typist's evidence is their clean-copy sentences in chronological order.
- **State.** For each sentence after the first, compute the state with `update` from the typist's earlier clean sentences. The browser uses at most the 200 most recent; Aalto histories are shorter, so use all earlier ones. The first sentence is never checked.
- **Checks.** Each a–z pair in the sentence with `m ≥ 1` intervals is one check. It is inside when `|logSum/m − (expected[p] + gap[p])| ≤ RANGE_Z · sqrt(variance[p] + sigma2[p]/m)`.
- **Coverage.** A typist's coverage is the share of their checks that are inside, pooled over their checked sentences.
- **Browser gate.** The browser takes the checks from the most recent `W = 20` checked sentences. Once at least `K = 8` sentences have been checked, coverage below `T` stops suggestions. Your job is to set `T`.

## Work

1. **`ml/coach/fit_check.py`** (new). Write a function that takes the fitted model and one typist's clean sentences, as per-pair counts and log sums in order, and returns each sentence's checks and inside counts. Add a `main` that runs the calibration below.
   - Import from `ml/coach/model.py` and `validation.py`; do not edit existing `ml/coach` files.
2. **Data.**
   - **Fit.** Fit with `fit_training` on `/home/owenc/typeforge-data/aalto-136m/dataset-v2/train.npz`. First verify its SHA256 `4ee076d14840e8ef9d5f8c69e2a35b20618567a44316e84df2003a28b4cc7b16`, then the fitted digest `c813005bd99f23fc88b9370490eb8dffa1792c57d5151d23b07047477fe85158`.
   - **Validation file.** Read `dataset-v2/validation.npz`. Check its SHA256 against the `validation.npz` pin in `ml/coach/b6.py` (`1924228510db…`), and stop and ask if it differs.
   - **Trial layout.** `score_split` and `grouped_intervals` in `ml/coach/validation.py` show how trials, reasons and clean intervals are laid out. Use the same clean-trial selection and `typist_avg_wpm_15` for the speed bands.
   - **Closed files.** Never open `test.npz`, legacy data, `coach-fresh-results.json`, or anything else beyond train and validation.
3. **Calibrate.** Report these from validation typists:
   - **Pooled coverage** of all checks, overall and by the bands in `ml/coach/REPORT.md` (<40, 40–<80, 80–<100, 100–<120, 120+ WPM).
   - **Per-typist coverage** for typists with at least `K = 8` checked sentences: their number, and the 1st, 2nd, 5th, 10th and 50th percentiles, overall and by band.
   - **Recommended `T`**: the 2nd percentile of per-typist coverage among those typists, rounded down to a whole percent, plus the share of each band at or below it.
   - **Stop and ask** if pooled coverage is below 0.70 or above 0.90. The range would then be mis-specified at the sentence level, and the check needs a different definition before C1b uses it.
4. **Parity fixture for the browser.** Write `ml/fixtures/fit-check-parity.json` with four small synthetic histories. Each is a list of sentences, and each sentence is `{pair: {count, logSum}}`.
   - For each sentence, give the expected checks and inside counts from your function, using the real fitted model.
   - Cover four cases:
     - a typist at a typical speed;
     - one beyond the speed support (about 190 WPM);
     - a sentence with a pair seen once and another seen three times;
     - the first sentence, which is never checked.
5. **Tests** in `ml/tests/test_fit_check.py`:
   - the inside test at the range boundary;
   - the first sentence left unchecked;
   - regenerating the fixture gives identical bytes.
6. **Report section.** Add a "Fit check" section of at most 15 lines to `ml/coach/REPORT.md`, directly after the "Fresh test" section. Give:
   - the definition, in one or two sentences;
   - the counts;
   - the percentiles;
   - `T`, with the share gated in each band;
   - the exact command.

## Owned paths

You own `ml/coach/fit_check.py`, `ml/tests/test_fit_check.py`, `ml/fixtures/fit-check-parity.json` and the new section of `ml/coach/REPORT.md`. Everything else is read-only.

## Done when

- `python -m unittest discover -s ml/tests` passes.
- Your report is in `artifacts/C1c.md`, at most 40 lines, and is not committed. It gives the results, `T` and the commands.
- Then send `worker_done` as `common.md` describes. Put `T`, the pooled coverage and the typist counts in its body.
