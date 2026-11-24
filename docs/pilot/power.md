# How much practice benefit could the pilot detect?

**Run Owen's self-trial first. Defer a volunteer study whose aim is to establish a 5% benefit.** With 20 clean occurrences per pair at each visit and twice the same-session variance, 15–20 completers detect a genuine 5% shortening in 15–18% of simulations. The corresponding estimate for one typist with eight matched sets is 12%. Owen's run can show whether the coach finds enough slow pairs at his speed, how much fresh typing they need and how noisy his measurements are across days.

A 15–20-person study is worth considering for feasibility across typists if Owen can complete each assessment within 15 minutes and keep targeted exposure distinct from incidental practice. With 20 completers, doubling the text from 20 to 40 occurrences moves power for a 10% shortening from 55% to 81% at twice the variance. Even 50 completers at 40 occurrences reach only 63% for a 5% shortening in that scenario. Check between-day variance and text burden before sizing an efficacy study. [Draft study protocol](preregistration.md)

## Reading the tables

Each cell gives **power in percent for intervals 3% / 5% / 10% shorter** on fresh text. Power is the chance of rejecting the no-effect hypothesis in a simulated complete trial. One occurrence is one eligible timing of that letter pair. Twenty per pair per visit requires 80 clean timings across two visits for one volunteer, or 640 for Owen with eight sets. The word count depends on the pairs. Owen's randomised comparison applies to his chosen pairs. The volunteer study estimates an average across eligible people who complete it.

Development had 1,634 physical-QWERTY users. 304 contributed 1,327 repeated person–pair cells.
The median count in a cell’s smaller half was 2. Cells reaching 10, 20 and 40 observations in both halves numbered 0, 0 and 0.
Observed variance of a single pair’s early-to-late change was 0.10100 squared log units. Within typists, variance across pair changes was 0.09766, of which 0.09722 was estimated sampling variance. The fitted floor was 0.00044.
Mean within-half interval variance was 0.11681.

| Volunteers | Occurrences per pair per visit | 1× variance | 1.5× variance | 2× variance |
|---:|---:|---:|---:|---:|
| 10 | 10 | 7 / 11 / 32 | 6 / 9 / 23 | 6 / 8 / 19 |
| 10 | 20 | 9 / 18 / 53 | 8 / 13 / 39 | 7 / 11 / 32 |
| 10 | 40 | 13 / 29 / 77 | 11 / 21 / 62 | 9 / 17 / 52 |
| 15 | 10 | 8 / 15 / 45 | 7 / 12 / 33 | 7 / 10 / 27 |
| 15 | 20 | 12 / 25 / 70 | 9 / 18 / 55 | 8 / 15 / 45 |
| 15 | 40 | 19 / 42 / 92 | 14 / 30 / 80 | 12 / 24 / 69 |
| 20 | 10 | 9 / 18 / 56 | 8 / 14 / 41 | 7 / 11 / 33 |
| 20 | 20 | 14 / 31 / 82 | 11 / 22 / 66 | 9 / 18 / 55 |
| 20 | 40 | 22 / 52 / 97 | 16 / 38 / 90 | 14 / 30 / 81 |
| 30 | 10 | 12 / 25 / 73 | 10 / 19 / 56 | 9 / 15 / 45 |
| 30 | 20 | 19 / 43 / 94 | 14 / 31 / 83 | 12 / 25 / 73 |
| 30 | 40 | 31 / 69 / 100 | 23 / 52 / 98 | 18 / 42 / 93 |
| 50 | 10 | 17 / 39 / 92 | 13 / 28 / 79 | 11 / 22 / 68 |
| 50 | 20 | 29 / 65 / 100 | 21 / 48 / 97 | 17 / 38 / 92 |
| 50 | 40 | 49 / 89 / 100 | 35 / 75 / 100 | 28 / 63 / 99 |

Zero-effect rejection rates for volunteers ranged from 4.5% to 5.0%.

| Owen's matched sets | Occurrences per pair per visit | 1× variance | 1.5× variance | 2× variance |
|---:|---:|---:|---:|---:|
| 4 | 10 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| 4 | 20 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| 4 | 40 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| 6 | 10 | 4 / 7 / 18 | 4 / 5 / 13 | 4 / 5 / 11 |
| 6 | 20 | 5 / 10 / 28 | 5 / 7 / 21 | 4 / 6 / 17 |
| 6 | 40 | 7 / 15 / 44 | 6 / 11 / 33 | 5 / 9 / 27 |
| 8 | 10 | 8 / 12 / 33 | 7 / 10 / 25 | 6 / 9 / 20 |
| 8 | 20 | 10 / 19 / 50 | 8 / 14 / 39 | 7 / 12 / 32 |
| 8 | 40 | 14 / 29 / 69 | 11 / 21 / 56 | 9 / 17 / 48 |

Zero-effect rejection rates for Owen were 4 sets 0.0%, 6 sets 2.9%, 8 sets 5.2%.

## Where the variance comes from

The input is the seed-42 Aalto 2,000-person acquisition. Rank participant IDs with the pipeline's split before examining keystrokes. Use 1,400 train and 300 validation assignments. The script verifies the manifest and the SHA-256 of the metadata and each eligible development file it opens. It never opens the 300 test keystroke files or pooled outcome files. Manifest SHA-256 (canonical JSON) is `3a756f95c07305c99179bbf1679639e9ec111d5c8e5aa2235df403bac404c30e`. [Dhakal et al., Aalto 136M Keystrokes](https://userinterfaces.aalto.fi/136Mkeystrokes/)

1. Order each physical-QWERTY user's sentence trials by first press and divide them into earlier and later halves **before** filtering. Use reconstructable, exact first-pass copies and the pipeline's lowercase within-word intervals longer than zero and at most 5,000 ms. These are conservative v1 measurements. The pilot will use v2, which can retain clean intervals inside corrected sentences.
2. Keep pairs observed at least twice in each half, and people with at least two such pairs. For each person and pair calculate late minus early mean log interval. The first reported variance describes these changes with equal weight per person and then per pair within person. To estimate noise for a randomised comparison, take the sample variance of pair changes *within* each person. This removes their common speed change. Calibration uses repeated pairs because phase B qualification is still pending.
3. For a pair with counts `a, b` and within-half sample variances `vA, vB`, sampling contributes `vA/a + vB/b`. Subtract its average from the within-person variance of changes, weighting people equally. The nonnegative remainder `B` estimates pair-specific drift beyond sampling. Let `W` be that person's mean of `(vA + vB)/2`. With `k` observations in each half, model the variance of one matched change contrast as `2 × (B + 2W/k)`. The leading two accounts for the two different pairs.
4. Simulate 10,000 trials per scenario (NumPy seed 20261124). Draw an empirical W per volunteer, or one W shared by all of Owen's sets in a trial. Generate independent normal contrasts conditional on W, adding `log(1 − effect)` for practice. Multiply the **variance** by 1, 1.5 or 2. Test an equally weighted volunteer mean with a two-sided one-sample t-test at 5%. For Owen, use the exact two-sided within-set label-flip test. All his matches belong to one person. Percentages are rounded, with Monte Carlo error at most about one percentage point either way at 95%.

Both Aalto halves share a keyboard, sitting and environment. The small drift estimate is the difference of two noisy quantities. All three proposed text amounts are extrapolations, and real between-day variance could exceed 2×. Fatigue, word context, correlated matches, errors and spillover to controls can change power. The simulation assumes a common effect, complete visits and successful matching. Owen's untreated repeat can check his day-to-day noise and text burden. Volunteer qualification and retention still need measurement.

## Reproduce

From the repository root in WSL with Python 3.14.4, NumPy 2.5.3 and SciPy 1.18.1, run the command below. It prints the aggregate measurements and both tables to standard output. The data directory is read-only.

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 \
  /mnt/c/Users/Owenc/Documents/GitHub/TypeForge/.venv/bin/python -B -m ml.pilot.power_sim \
  /mnt/c/Users/Owenc/Documents/GitHub/TypeForge/ml/data
```
