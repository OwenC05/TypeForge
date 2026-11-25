# TypeForge coaching model evaluation

## Fresh test

**Pass.** L5 reduced mean absolute error (MAE) for later pair timing by **0.08346 log ms** against the typist’s own earlier average (L1). The paired 95% participant-bootstrap interval was **0.07916–0.08775 log ms**. Of 16,659 assigned typists, 4,240 could be scored. The registration required at least 800 and a lower bound above 0.020 log ms.

| Source WPM | Scored / assigned | Qualifying cells | L1 MAE | L5 MAE | Ranked typists / cells | L5 precision at 3 | L5 Spearman | L5 80% range coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| All | 4,240 / 16,659 | 13,906 | 0.2877 | 0.2042 | 1,403 / 9,071 | 0.656 | 0.351 | 82.5% |
| <40 | 830 / 5,780 | 2,242 | 0.3041 | 0.2228 | 198 / 1,224 | 0.658 | 0.362 | 79.1% |
| 40–<80 | 2,678 / 9,397 | 8,727 | 0.2907 | 0.2004 | 882 / 5,658 | 0.670 | 0.371 | 83.1% |
| 80–<100 | 583 / 1,231 | 2,293 | 0.2618 | 0.1977 | 244 / 1,675 | 0.627 | 0.312 | 84.1% |
| 100–<120 | 140 / 238 | 613 | 0.2438 | 0.1940 | 73 / 487 | 0.562 | 0.220 | 84.1% |
| 120+ | 9 / 13 | 31 | 0.2403 | 0.1945 | 6 / 27 | 0.667 | 0.098 | 88.1% |

MAE and coverage use pairs with at least two clean observations in each half. Ranking requires four qualifying pairs per typist. Across the same 4,240 scored typists, MAE was 0.3429 log ms for the population pair mean (L0), 0.2258 for the speed-adjusted pair mean (L2), 0.2219 for Ridge (L3) and 0.2410 for the typist’s own earlier mean for that pair.

At the midpoint, 8,353/16,659 typists had a practice pair observed at least twice. Whenever L5 issued, the matched reference picked the pair with the largest raw timing gap from the typist’s other intervals. A hit required at least two later observations and a later pair time more than 10% above the speed-adjusted expectation.

| Rule | Issued / assigned (yield) | Hits / checkable (rate, exact 95% interval) | Unknown / issued | Possible hit rate across all issued | Same pair / either half | Same pair / both halves |
| --- | --- | --- | --- | --- | --- | --- |
| L5 | 484/16,659 (2.91%) | 79/111 (71.2%, 61.8–79.4%) | 373/484 | 16.3–93.4% | 13/1,039 | 13/56 |
| Matched reference | 484/16,659 (2.91%) | 60/92 (65.2%, 54.6–74.9%) | 392/484 | 12.4–93.4% | 6/1,039 | 6/56 |

L5 recorded 19 more confirmed hits across 16,659 assignments, a paired difference of +0.1141 percentage points (95% bootstrap +0.0480 to +0.1861). L5 issued suggestions to 0/6,809 typists with no earlier clean sentence, 29/3,380 with one, 92/2,728 with two, 243/3,034 with three or four, and 120/708 with five or more.

Of 9,850 typists with earlier clean intervals, 241 fell outside the training speed range. Withholding 100+ WPM typists from the speed fit increased MAE by 0.00097 log ms for L2 (95% bootstrap 0.00004 to 0.00180) and 0.00041 for L5 (−0.00011 to 0.00094), across 149/251 fresh typists at 100+ WPM and 644 qualifying cells. The fastest scored typist was at 130.1 WPM.

Under D12, this prediction result allows L5 to choose pairs in TypeForge and in a practice trial. A prospective trial is needed to establish whether practising those pairs improves typing and whether L5’s choices outperform the current rule’s. The aggregate file gives all subgroup results, denominators and intervals, including exact binomial intervals for binary rates. [Fresh results](fresh.json)

Derived clean `test.npz` SHA256 `f31d5a0999dfb99d6b048119e892db117341922a4f04e6cc39a0a86d9f807148`. The registered run used this command from the worktree root in WSL.

```sh
OPENBLAS_NUM_THREADS=1 PYTHONDONTWRITEBYTECODE=1 /mnt/c/Users/Owenc/Documents/GitHub/TypeForge/.venv/bin/python -m ml.coach.b6 fresh /home/owenc/typeforge-data/aalto-136m /mnt/c/Users/Owenc/Documents/GitHub/TypeForge/ml/data/raw/metadata_participants.txt /home/owenc/typeforge-data/aalto-136m/coach-fresh-results.json
```

## Validation

**L5 predicted later pair timing more accurately than the typist’s own earlier average.** Across 4,195 of 16,659 validation typists and 14,065 qualifying typist-pair cells, the paired reduction in mean absolute error was **0.0841 log ms** (95% participant-bootstrap interval 0.0799–0.0883). The fresh decision requires at least 800 scored typists and a lower bound above 0.020. A pass licenses using L5 to choose pairs in TypeForge and in a prospective practice trial. Only such a trial can establish whether practice improves typing or whether L5 chooses better practice pairs than the current rule. [Frozen registration](PREREG.md)

## Timing and ranking

Train supplied 7,950,952 clean intervals across 134,975 assignments. Validation supplied 984,094 across 16,659. Each prediction used the first half of that typist’s chronological trials. A pair needed two clean observations in each half. Each typist’s mean absolute error (MAE) weights their qualifying pairs equally, and the overall MAE weights typists equally. Brackets give 95% intervals from 2,000 participant-bootstrap draws.

L0 uses the train pair mean, L1 the typist’s earlier mean and L2 the pair-by-speed expectation. L3 applies the published Ridge to the earlier word contexts. L5 adds a shrunken personal gap to L2. All five columns show later-mean MAE in log ms on the same cells.

| Source WPM | Scored / assigned | Cells | L0 | L1 | L2 | L3 | L5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| All | 4,195 / 16,659 | 14,065 | 0.347 [0.340, 0.354] | 0.290 [0.285, 0.295] | 0.227 [0.223, 0.231] | 0.225 [0.221, 0.229] | 0.206 [0.202, 0.210] |
| <40 | 842 / 5,630 | 2,381 | 0.503 [0.484, 0.522] | 0.301 [0.289, 0.314] | 0.238 [0.227, 0.249] | 0.244 [0.233, 0.255] | 0.220 [0.209, 0.231] |
| 40–<80 | 2,573 / 9,520 | 8,521 | 0.273 [0.267, 0.280] | 0.295 [0.289, 0.301] | 0.226 [0.221, 0.232] | 0.221 [0.215, 0.226] | 0.204 [0.199, 0.210] |
| 80–<100 | 637 / 1,275 | 2,467 | 0.401 [0.387, 0.415] | 0.268 [0.257, 0.281] | 0.218 [0.208, 0.229] | 0.219 [0.209, 0.230] | 0.199 [0.189, 0.210] |
| 100–<120 | 133 / 216 | 641 | 0.500 [0.472, 0.528] | 0.236 [0.216, 0.257] | 0.208 [0.190, 0.228] | 0.220 [0.203, 0.237] | 0.189 [0.171, 0.209] |
| 120+ | 10 / 18 | 55 | 0.666 [0.584, 0.743] | 0.243 [0.202, 0.293] | 0.208 [0.162, 0.269] | 0.214 [0.159, 0.274] | 0.196 [0.150, 0.248] |

Precision at three measures overlap with the three largest observed later personal gaps. Spearman measures rank agreement. Both require at least four common pairs. L5’s nominal 80% range predicts the later mean log interval per cell. The remaining rung rankings, subgroup intervals and per-metric denominators are in the aggregate file. [Validation results](validation.json)

| Source WPM | Ranked typists / cells | Precision at three | Spearman | Range typists / cells | 80% coverage (%) |
| --- | --- | --- | --- | --- | --- |
| All | 1,428 / 9,325 | 0.661 [0.648, 0.673] | 0.365 [0.342, 0.388] | 4,195 / 14,065 | 82.3 [81.4, 83.2] |
| <40 | 223 / 1,365 | 0.685 [0.652, 0.716] | 0.386 [0.321, 0.446] | 842 / 2,381 | 80.1 [78.0, 82.2] |
| 40–<80 | 854 / 5,548 | 0.667 [0.652, 0.683] | 0.369 [0.341, 0.399] | 2,573 / 8,521 | 82.5 [81.4, 83.6] |
| 80–<100 | 270 / 1,835 | 0.641 [0.611, 0.668] | 0.342 [0.286, 0.396] | 637 / 2,467 | 84.9 [82.9, 86.7] |
| 100–<120 | 75 / 533 | 0.600 [0.538, 0.658] | 0.352 [0.255, 0.446] | 133 / 641 | 80.7 [75.8, 85.0] |
| 120+ | 6 / 44 | 0.556 [0.278, 0.778] | 0.227 [-0.079, 0.536] | 10 / 55 | 85.1 [70.8, 95.8] |

## Coaching replay

L5 picks one bank pair when its posterior probability of a personal gap above 10% exceeds 95%. The matched reference acts in each half where L5 issues. It subtracts the mean log interval of all other clean intervals from each bank pair’s raw mean log interval, then picks the largest difference. A pair needs two observations and a nonempty complement. Both rules use the same 100-pair bank. A hit requires two later observations and a later gap above 10%. B5 found that 0/16,659 validation typists reached the shipped rule’s minimum of 20 earlier target observations.

| Source WPM | Assigned / issued per rule | L5 adjudicable / hits / unknown | Reference adjudicable / hits / unknown | Same pair L5 / reference | Either / both halves per rule | Paired gain (pp) |
| --- | --- | --- | --- | --- | --- | --- |
| All | 16,659 / 478 | 100 / 76 / 378 | 72 / 46 / 406 | 13 / 6 | 1,007 / 61 | 0.180 [0.114, 0.258] |
| <40 | 5,630 / 137 | 20 / 13 / 117 | 16 / 9 / 121 | 1 / 1 | 301 / 14 | 0.071 [0.000, 0.160] |
| 40–<80 | 9,520 / 249 | 58 / 43 / 191 | 46 / 30 / 203 | 7 / 3 | 548 / 29 | 0.137 [0.063, 0.221] |
| 80–<100 | 1,275 / 72 | 16 / 14 / 56 | 7 / 4 / 65 | 3 / 1 | 133 / 14 | 0.784 [0.235, 1.333] |
| 100–<120 | 216 / 20 | 6 / 6 / 14 | 3 / 3 / 17 | 2 / 1 | 25 / 4 | 1.389 [0.000, 3.241] |
| 120+ | 18 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 | 0 / 0 | 0.000 [0.000, 0.000] |

“Either” and “both” count people who received a suggestion in the indicated halves. “Unknown” counts early suggestions with too few later observations. The paired gain is the L5 minus reference difference in confirmed hits per assigned typist, in percentage points. Overall that was **30 extra confirmed hits per 16,659 assigned**, or **+0.1801 percentage points** (95% participant bootstrap +0.1141 to +0.2581). Across all 478 suggestions per rule, L5’s 378 unknowns permit 76–454 hits (15.9–95.0%). The reference’s 406 unknowns permit 46–452 hits (9.6–94.6%). The ranking comparison is descriptive.

| Rule and outcome | Count / denominator | Rate (%) | Bootstrap 95% (%) | Exact 95% (%) |
| --- | --- | --- | --- | --- |
| Both · bank pair observed twice | 8,352/16,659 | 50.14 | [49.39, 50.87] | [49.37, 50.90] |
| Both · issued per assigned | 478/16,659 | 2.87 | [2.61, 3.13] | [2.62, 3.13] |
| L5 · hit per adjudicable | 76/100 | 76.00 | [67.00, 84.00] | [66.43, 83.98] |
| Reference · hit per adjudicable | 46/72 | 63.89 | [52.78, 75.00] | [51.71, 74.88] |
| L5 · confirmed per assigned | 76/16,659 | 0.46 | [0.36, 0.56] | [0.36, 0.57] |
| Reference · confirmed per assigned | 46/16,659 | 0.28 | [0.20, 0.36] | [0.20, 0.37] |
| L5 · same per either half | 13/1,007 | 1.29 | [0.60, 1.99] | [0.69, 2.20] |
| Reference · same per either half | 6/1,007 | 0.60 | [0.20, 1.09] | [0.22, 1.29] |
| L5 · same per both halves | 13/61 | 21.31 | [11.48, 32.79] | [11.86, 33.68] |
| Reference · same per both halves | 6/61 | 9.84 | [3.28, 18.03] | [3.70, 20.19] |

In the 100–<120 WPM band L5 had 6 hits from 6 adjudicable choices. The bootstrap gave 100–100% and the two-sided Clopper–Pearson interval gave 54.1–100%. At 120+ WPM neither rule issued an early suggestion among 18 assignments. The aggregate file gives both intervals for each binary rate in every band and sentence-count group. [Validation results](validation.json)

| Earlier clean sentences | Issued / assigned | Yield (%) | Bootstrap 95% (%) | Exact 95% (%) |
| --- | --- | --- | --- | --- |
| 0 | 0/6,918 | 0.00 | [0.00, 0.00] | [0.00, 0.05] |
| 1 | 23/3,204 | 0.72 | [0.44, 1.00] | [0.46, 1.08] |
| 2 | 97/2,758 | 3.52 | [2.83, 4.24] | [2.86, 4.27] |
| 3–4 | 234/3,069 | 7.62 | [6.65, 8.63] | [6.71, 8.62] |
| 5+ | 124/710 | 17.46 | [14.65, 20.42] | [14.74, 20.46] |

Training had 392,795 clean sentences among 93,478 typists with a clean sentence (4.20 each), or 2.91 per typist across all 134,975 assignments. Only 4,195/16,659 validation typists had a qualifying pair, and 8,096/14,065 cells had just two later observations. Longer app histories can give the coach more evidence. How frequently it issues suggestions and whether they persist across days still need longitudinal observation.

## Speed support and corrected sentences

The central 98% of pair-mix-adjusted speeds spanned 80.4–376.3 ms among 83,710 training typists with at least 20 intervals. Outside this range the model holds the pair pattern at the boundary and continues the user’s observed overall pace. In validation, 11/14 typists at 120+ WPM with an earlier interval were outside support (95% bootstrap 57.1–100%, exact 49.2–95.3%).

D10 withheld the 1,544 training typists with clean intervals at 100+ WPM from the speed fit. Costs are paired restricted minus full MAE in log ms, with the same variance estimates and evaluation cells.

| Source WPM | Scored / assigned | Cells | L2 full / restricted | L2 cost | L5 full / restricted | L5 cost |
| --- | --- | --- | --- | --- | --- | --- |
| 100+ | 143 / 234 | 696 | 0.2084 / 0.2104 | 0.0020 [0.0012, 0.0029] | 0.1897 / 0.1907 | 0.0011 [0.0006, 0.0016] |
| 100–<120 | 133 / 216 | 641 | 0.2084 / 0.2106 | 0.0022 [0.0014, 0.0031] | 0.1892 / 0.1903 | 0.0012 [0.0006, 0.0017] |
| 120+ | 10 / 18 | 55 | 0.2078 / 0.2073 | -0.0005 [-0.0029, 0.0019] | 0.1962 / 0.1957 | -0.0005 [-0.0023, 0.0011] |

The fastest training typist among 134,975 assignments was at 152.6 WPM. The fastest of the 4,195 scored validation typists was at 147.2. Only 10/18 assigned typists at 120+ contributed to error and 6/18 to ranking. Nobody approached 190 WPM. At that speed the boundary pattern is an extrapolation, and its accuracy needs observations from faster users.

D2 added B3’s eligible corrected-sentence intervals to the earlier history. Both variants use the same later clean targets. The gain of 0.0036 log ms among 4,195 scored typists fell below the 0.020 margin for changing eligibility. The fresh registration uses clean-copy histories. Each rate below gives its count and denominator, then the participant-bootstrap and exact binomial intervals.

| Source WPM | Scored typists / cells | Augmented MAE | Clean minus augmented | Issued / assigned · bootstrap / exact (%) | Hits / adjudicable · bootstrap / exact (%) |
| --- | --- | --- | --- | --- | --- |
| All | 4,195 / 14,065 | 0.202 [0.199, 0.207] | 0.0036 [0.0025, 0.0047] | 1,298/16,659 · [7.4, 8.2] / [7.4, 8.2] | 178/241 · [68.5, 79.7] / [67.8, 79.3] |
| <40 | 842 / 2,381 | 0.217 [0.206, 0.228] | 0.0033 [0.0003, 0.0062] | 425/5,630 · [6.9, 8.3] / [6.9, 8.3] | 40/64 · [50.0, 75.0] / [49.5, 74.3] |
| 40–<80 | 2,573 / 8,521 | 0.200 [0.195, 0.206] | 0.0037 [0.0024, 0.0052] | 712/9,520 · [7.0, 8.0] / [7.0, 8.0] | 98/133 · [66.1, 81.2] / [65.3, 80.9] |
| 80–<100 | 637 / 2,467 | 0.196 [0.186, 0.207] | 0.0027 [0.0003, 0.0050] | 130/1,275 · [8.5, 12.0] / [8.6, 12.0] | 28/31 · [80.6, 100.0] / [74.2, 98.0] |
| 100–<120 | 133 / 641 | 0.183 [0.166, 0.203] | 0.0058 [0.0020, 0.0098] | 30/216 · [9.3, 18.5] / [9.6, 19.2] | 11/12 · [75.0, 100.0] / [61.5, 99.8] |
| 120+ | 10 / 55 | 0.190 [0.141, 0.243] | 0.0065 [0.0003, 0.0135] | 1/18 · [0.0, 16.7] / [0.1, 27.3] | 1/1 · — / [2.5, 100.0] |

## B6 validation dry run

Driver and scorer revision `493aee5d20c9a1bb80c826623f96f489a09dc170` rebuilt the clean validation NPZ byte for byte. All 15 arrays, every non-D2 metric and the fitted digest matched. All 914 previously recorded scalar or null values in the validation JSON reproduced exactly, including D2. The dry run used the pinned B3 builder read-only from its sibling worktree because this branch predates B3 integration. B6 uses the integrated checkout. To reproduce the dry run there, use the registered command with `validation` and a new output filename. [Command and input identities](PREREG.md#identity-and-execution)

| Verified artifact | SHA256 |
| --- | --- |
| Rebuilt clean validation NPZ | `1924228510dbf4a84c93f2d097bddd2e7503b3455c8a7762d350bea4f5dbed94` |
| Fitted full model | `c813005bd99f23fc88b9370490eb8dffa1792c57d5151d23b07047477fe85158` |
| Validation driver output | `96ffdd2cf07dcc690c4bad0292e1489353177fcab0bfd1782cb98c83f8e6fb5f` |
| Aggregate validation JSON including D2 (Git LF) | `ef88838cd24c4edde0eecb9967239cee9b94847b6dddc2766d250b18687f88b0` |
| Amended registration at `bd8b32a7f253114bbcd167d32538c4e64501aa73` (Git LF) | `8acabf31d6eefef24341550d1eef5ab2e95125d82d8f084b3925fedaa266f5ae` |

`wsl -e env OPENBLAS_NUM_THREADS=1 PYTHONDONTWRITEBYTECODE=1 /mnt/c/Users/Owenc/Documents/GitHub/TypeForge/.venv/bin/python -m unittest discover -s ml/tests` passed 61/61 tests, including 19 coach tests. The final repeat passed after one WSL startup timeout (0x8007274c). A synthetic integration run through B3’s builder scored 2/2 fabricated typists and 4 cells and returned `fail_insufficient_data`. The fresh and legacy sets stayed sealed for B5’s re-check.
