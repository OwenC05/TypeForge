B4 Coaching model ladder, coach replay and fresh-test pre-registration

Read `.omx/plans/model-coach-20261124/common.md` and `plan.md` first, especially "The model", D2, D10 and D11. You are worker B4. No port. Python runs in WSL as `common.md` describes, with `OPENBLAS_NUM_THREADS=1` for every fit. The published training hashes depend on the BLAS thread count; see `ml/REFACTOR-REPORT.md`.

## Why

TypeForge's coach should suggest the letter pairs where a typist is slower than expected for someone at their speed, and only when the evidence is strong. This task decides which model does that best on typists it never saw. It measures how the model behaves for fast typists the data barely cover. It then freezes how the fresh test set will be scored.

## Inputs

- B3's datasets for train and validation, built in parallel by worker B3 under `/home/owenc/typeforge-data/aalto-136m/dataset-v2/`. I will send you their paths and hashes when B3 finishes. Until then, work on steps 1 to 3 with synthetic data. You may also develop against the 1,700 historical development typists through A1's package (`TYPEFORGE_DATA_DIR=/mnt/c/Users/Owenc/Documents/GitHub/TypeForge/ml/data`, read-only), using only their train and validation assignments. Final numbers come from B3's datasets. Never open fresh or legacy test data.
- Pair frequencies `f_p`: `ml/corpus/pair_frequencies.json` (A3), the text TypeForge's typists will actually type.
- L3: the frozen published Ridge as exported in the repository. Do not retrain it. If its features make an identical comparison impossible, explain why in the report and leave it out.

## Steps

1. Implement the ladder in a new `ml/coach/` package:
   - L0: population pair mean.
   - L1: the typist's own average, the current rule's family.
   - L2: pair by speed.
   - L3: the frozen Ridge.
   - L5: L2 plus a shrunken personal gap with a closed-form posterior that the browser can update after every sentence.

   Every rung gets identical inputs. The population parts come from train. Each validation typist's personal parts and speed come from the earlier half of their trials.
2. Speed and support (D10). Compute a pair-mix-adjusted speed from the earlier half only. Set the supported speed range from the training data and fix the rule for faster typists.
   - Extrapolation check: fit the speed terms only on typists below a cut that leaves a meaningful validation group above it (for example 110 WPM by `AVG_WPM_15`). Score that group, and compare with the full fit.
3. Coach replay. From each typist's earlier half, suggest a pair when the posterior probability of a gap above a minimum meaningful size clears a threshold. Rank suggestions by `f_p * E[interval] * (exp(d_hat) - 1)`. Report:
   - yield: the share of typists with a suggestion, by number of earlier-half sentences;
   - hit rate: the share of suggested pairs that are slow in the later half, as defined in the pre-registration.
4. Evaluate on validation within typists, from the earlier half to the later half.
   - Primary metric: participant-macro mean absolute error, in log milliseconds, between each scored pair's predicted and observed later-half mean. Score only typist-pair cells with a minimum count in both halves.
   - Secondary metrics: weakest-pair precision at 3 and Spearman, suggestion stability across halves, coverage of nominal 80% ranges, and coach yield and hit rate.
   - Report every metric by speed band: below 40, 40 to 80, 80 to 100, 100 to 120 and 120+ WPM, grouped by `AVG_WPM_15`. Give bootstrap intervals over typists, and report how many cells and typists qualify.
5. D2 comparison. Compare L5 fitted on earlier-half clean intervals with L5 fitted on clean intervals plus B3's corrected-sentence intervals. Score both on the same later-half clean targets. Label it secondary.
6. Write the two documents:
   - `ml/coach/PREREG.md` (at most about 150 lines) for the fresh test. It covers the chosen model and every frozen setting, the primary metric and the margin by which it must beat L1 (with a one-line justification), minimum counts, speed bands, secondary metrics, the coach threshold, the speed rule, what counts as success or failure, and the exact code commit and data hashes. Record its SHA256.
   - `ml/coach/REPORT.md` (at most about 150 lines) with the validation results and their limits: Aalto typists have about four clean sentences each, and no typist is near 190 WPM. Say what both mean for real users.

## Owned paths

`ml/coach/**` and `ml/tests/test_coach*.py`. Read everything else, but do not edit it.

## Done when

Validation results exist for every rung, the extrapolation check and the D2 comparison. The pre-registration is complete and hashed. `python -m unittest discover -s ml/tests` passes, and `worker_done` follows `common.md`. No fresh-test number may exist yet: B5 reviews the pre-registration and code before B6 opens the test set.
