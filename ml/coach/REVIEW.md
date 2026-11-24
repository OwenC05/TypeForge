# B5 independent review of the fresh-test registration

**APPROVE WITH CHANGES. Keep the fresh assignment sealed.** The timing results reproduce.
Before B6, freeze a working fresh-data command and limit the decision that a passing result can authorize.
Publish the amended registration's SHA256 with the driver revision before opening the fresh assignment.
The review covered B4 merge `f0c03e4` and registration SHA256
`b02c11bae561d7a6fef0f071e73b1c04969e534d545014a6ad1f2be772edcfde` (Git LF).
Every participant record I used came from train or validation. The fresh and legacy assignments and shards stayed closed.

## Independent validation

I refit from individual train intervals, then separately implemented the chronological cutoff, posterior,
selection, later labels and participant bootstrap without importing TypeForge code. Of 16,659 assigned
validation typists, 4,195 had a qualifying pair. The common mask contained 14,065 cells.

| Participant-macro result (log ms) | Independent estimate | 95% participant-bootstrap interval |
| --- | ---: | ---: |
| L1, earlier overall mean | 0.2901002515 | [0.2852990254, 0.2950888766] |
| L5, pair-by-speed plus personal gap | 0.2060239917 | [0.2021850128, 0.2104118559] |
| L1 minus L5, paired by typist | 0.0840762598 | [0.0799280966, 0.0883144774] |

All **33,318** earlier and later picks, including abstentions, matched a trace of the pinned scorer in
roster order. The independent counts were 478 early picks, 100 adjudicable and 76 hits. Both halves
issued for 61 people and either half issued for 1,007. Thirteen got the same pair. See
`validation.json:44,68,193` and `REPORT.md:46–52`.
The B4 command at `REPORT.md:105–111`, writing to `artifacts/b4-validation.json`, reproduced the Git
blob byte for byte (SHA256 `61c68ea50899e483f686b51caab1201e67f22e23f4e085e969c4b645a10da733`).
The full fit matched `c813005bd99f23fc88b9370490eb8dffa1792c57d5151d23b07047477fe85158`.

## Isolation and fidelity

- A8 separates the prior 2,000 before fresh allocation. The original Ridge training and tuning
  participants now belong to B3 train (`ml/full_archive/ingest.py:39–54`, `ml/ridge.py:45–76`).
  L0, L2 and L5 fit only clean train. D10 refits the speed terms below 100 WPM and deliberately shares
  full-train variances. The CLI verifies the three named development NPZs before loading their arrays.
  It records corpus and Ridge hashes after scoring. The scorer reads supplied arrays and performs no
  assignment discovery (`validation.py:17,44–62,130–148`).
- The cutoff counts rejected trials. The early state supplies pace, gaps, Ridge history and the pick.
  Labels use later clean intervals and later pace with the frozen L2. The target pair contributes to
  that pace, so the label measures a relative gap within the later sample. Synthetic perturbations
  changed a hit while preserving the early prediction and pick, and changed the early pick while preserving
  the later labels. D2 adds only early corrected intervals on the original clean scoring mask
  (`replay.py:89–129,143–149`). Its validation gain was 0.00357 [0.00250, 0.00468], below 0.020.
- Empty early history takes the train center and abstains. Empty later history leaves the outcome unknown.
  Missing pairs cannot enter MAE or hit adjudication. A missing source WPM encoded as NaN retains the
  overall row and skips speed bands and D10. Exact suggestion ties choose the alphabetically first pair,
  top-three ties get fractional credit, and constant ranks have undefined Spearman correlation
  (`model.py:162–184`, `replay.py:71–86,101–110,153–169,185–186`). Synthetic checks confirmed these cases.
- **Note for later.** Write the 80% range multiplier as the standard-normal 90th percentile
  (`model.py:14`). The rounded value in `PREREG.md:34` changed zero validation classifications.
  Independent participant-macro coverage was 82.34%.

## Changes before B6

**1. Blocks B6 — pin the fresh builder and scorer invocation.** `PREREG.md:42–59` names the ingredients.
B3's public command iterates only train and validation (`ml/dataset_v2.py:24,153–194`). Passing a path
literally to `score_split` raises `TypeError`. It accepts an open array mapping and checks only split-local
indices (`validation.py:92–108`). Validation also has 16,659 typists, so a roster-size check alone is insufficient.

- Commit one B6 driver using B3 `c5dcd6258251fb05fdf85b570a7b678335b89e4d` and scorer
  `f9fe277e179d8acc97e0e44742156b8d5579ae8e`, both present at `f0c03e4`. Publish its exact command and
  Git revision. Dry-run it on validation before unlocking. Match B3's clean arrays, all non-D2 validation
  metrics and the full-fit digest.
- At unlock verify the registered ingest/split manifests and the `test/ids.txt` digest. In that roster's
  lexical order, join source WPM from `raw/metadata_participants.txt` (SHA256
  `3ba22e2c23dbcbb5645197b9dd68c17e9ef68a1be7170e1bc1f0cd869a68ac6d`, pinned through B3 metadata).
  A8 extracts source speed only for development (`ml/full_archive/ingest.py:140–153,278–279`).
  Map absent, unparseable or nonfinite speed to NaN. The current float conversion and dictionary lookup can
  raise on missing values (`ml/dataset_v2.py:175–191`). Pass the verified manifest entries, in order,
  to `_build_split(pool, snapshot, entries, stage, "test", speeds, [])`. It checks each selected shard
  and writes clean-only `stage/test.npz` (`ml/dataset_v2.py:52–55,109–140`).
- Record the derived SHA256 before scoring. Verify the pinned train, corpus, Ridge and fitted digest
  against the registration. Unpack `model, limited, stats = fit_training(train_path)` and
  `ridge, frequency = coach_inputs()`. Open the verified NPZ with `allow_pickle=False`, then call
  `score_split(model, limited, ridge, frequency, data)` once. The new driver and derived-file identity
  are the missing links. The input manifests already pin shard and metadata contents transitively.

**2. Blocks B6 as a coach-replacement decision.** Keep the 0.020 lower-bound
gate for timing prediction. It represents about 2% in the multiplicative error factor. L1 issues no
recommendations. L5's gain over the stronger L2 was 0.02063 [0.01836, 0.02287] (`REPORT.md:7–13`).
The shipped rule compares a target with its complement and requires a ratio of at least 1.25, ten baseline
tests, 20 target and 80 reference intervals, context diversity and support in both time windows. It can select four pairs
(`typing-app/client/src/coach-config.json:6–8,41–58,76–81`, `typing-app/client/src/coach-policy.ts:247–285`).
Across validation, an earlier half had at most seven trials and at most 11 observations of any shipped
pair. **Zero** could clear the shipped target-count threshold. Aalto supplies no randomized practice outcome.
Amend `PREREG.md:5` and the C1 handoff at `.omx/plans/model-coach-20261124/plan.md:65` so a pass advances L5 to a practice trial.
Require a prospective comparison with current practice before claiming better practice or replacing the rule.

**3. Should be fixed before B6 — freeze reference points for coaching.** In `PREREG.md:30–36` add a
descriptive comparison in each half where L5 issues. Use its 100-pair bank and require two observations
in that half. Choose the largest raw mean log interval minus the mean of all other clean intervals. Require a nonempty
complement, abstain if none qualifies, and break exact ties alphabetically. This tests ranking at
matched issuance. Freeze the comparator's code and bank identity before using it on fresh.
On validation this rule hit 46/72 checkable choices versus L5's 76/100 across the same 478 issuers.
It repeated the pair for 6/61 people receiving suggestions in both halves versus 13/61 for L5.
The corresponding counts on the registered denominator were 6/1,007 and 13/1,007.
For yield, 8,352/16,659 had any candidate with two earlier observations and 478 received
a suggestion. Report assigned, issued, adjudicable, hits and both stability denominators for each rule.
Only 76/16,659 had a confirmed L5 hit. With 378 unknown outcomes, the all-issued hit fraction could
range from 15.9% to 95.0%. Keep unknowns explicit and report paired differences in confirmed hits per assigned typist.

**4. Should be fixed before B6 — define minimum information for an interval.** Two observations per half
are a defensible recurrence check. They limit the estimand to 25.2% of assigned typists, and 8,096/14,065
cells have exactly two later observations. `replay.py:153–169,209–215` can pass two identical gains above
the margin. Set an overall floor of 800 scored typists for a decision (validation paired SD 0.143 gives
an approximate 95% half-width of 0.010 at 800). Keep sparse subgroups descriptive. For binary rates,
publish binomial intervals alongside the bootstrap at all-zero/all-one outcomes. The reported 6/6
has a two-sided exact 95% interval of 54.1–100% (`REPORT.md:56`).

**Note for later.** `REPORT.md:70,80–84` limits its conclusions appropriately. The D10 restricted L5
cost was 0.0011 log ms for 143 scored typists at 100+ WPM. Only ten 120+ WPM typists
contributed to MAE and none received an early suggestion. The fastest scored was 147.2 WPM. Accuracy
near 190 WPM, stability over days and typing improvement require new observations.

Private checks are in `artifacts/b5_independent.py`, `b5_trace.py` and `b5_edges.py`. WSL Python 3.14.4,
NumPy 2.5.3, SciPy 1.18.1, `OPENBLAS_NUM_THREADS=1`. `python -m unittest discover -s ml/tests` passed
55/55. An initial run failed to resolve the worktree HEAD in WSL. Both a run with explicit Git paths
and a repeat of the plain command passed.
