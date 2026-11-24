# TypeForge coaching model validation

**Select L5 for independent fresh-test review.** On 4,195 held-out validation typists, adding a shrunken personal gap to the pair-by-speed expectation gave the lowest error of the five rungs. Its paired improvement over the typist's own average was **0.0841 log ms** (95% interval 0.0799–0.0883). The protocol requires the fresh lower bound to exceed 0.020. These results come entirely from development data. [Frozen registration](PREREG.md)

## Prediction on later clean trials

B3 supplied 7,950,952 clean training intervals and 984,094 clean validation intervals. We split each typist at the midpoint of all chronological trials, including rejections. A cell needed two clean observations of the same pair on each side. Each cell contributes equally within a typist, and each qualifying typist contributes equally to mean absolute error (MAE). Brackets give 95% percentile intervals from 2,000 participant bootstrap draws.

L0 uses the train pair mean, L1 the typist's earlier mean, L2 the pair-by-speed fit, and L5 the personal posterior. L3 applies the unmodified published Ridge to the pair's earlier word contexts with history frozen at the cutoff. The paired L5 gains over L2 and L3 were 0.0206 [0.0184, 0.0229] and 0.0190 [0.0169, 0.0210] log ms. Using the raw earlier mean of each personal pair gave MAE 0.2448 [0.2395, 0.2505]. All estimates and denominator counts are available at full precision. [Aggregate results](validation.json)

| Source WPM | Assigned / scored typists | Cells | L0 | L1 | L2 | L3 | L5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| All | 16,659 / 4,195 | 14,065 | 0.347 [0.340, 0.354] | 0.290 [0.285, 0.295] | 0.227 [0.223, 0.231] | 0.225 [0.221, 0.229] | 0.206 [0.202, 0.210] |
| <40 | 5,630 / 842 | 2,381 | 0.503 [0.484, 0.522] | 0.301 [0.289, 0.314] | 0.238 [0.227, 0.249] | 0.244 [0.233, 0.255] | 0.220 [0.209, 0.231] |
| 40–<80 | 9,520 / 2,573 | 8,521 | 0.273 [0.267, 0.280] | 0.295 [0.289, 0.301] | 0.226 [0.221, 0.232] | 0.221 [0.215, 0.226] | 0.204 [0.199, 0.210] |
| 80–<100 | 1,275 / 637 | 2,467 | 0.401 [0.387, 0.415] | 0.268 [0.257, 0.281] | 0.218 [0.208, 0.229] | 0.219 [0.209, 0.230] | 0.199 [0.189, 0.210] |
| 100–<120 | 216 / 133 | 641 | 0.500 [0.472, 0.528] | 0.236 [0.216, 0.257] | 0.208 [0.190, 0.228] | 0.220 [0.203, 0.237] | 0.189 [0.171, 0.209] |
| 120+ | 18 / 10 | 55 | 0.666 [0.584, 0.743] | 0.243 [0.202, 0.293] | 0.208 [0.162, 0.269] | 0.214 [0.159, 0.274] | 0.196 [0.150, 0.248] |

## Recovering the weakest pairs

Precision at three measures overlap with the later three largest **personal gaps** after allowing for the typist's pace and the difficulty of each pair. At least four common pairs are required. L2 assigns a zero personal gap everywhere, so its tie-adjusted precision gives an uninformative ordering as a reference.

| Source WPM | Typists / cells | L0 | L1 | L2 | L3 | L5 |
| --- | --- | --- | --- | --- | --- | --- |
| All | 1,428 / 9,325 | 0.529 [0.516, 0.543] | 0.531 [0.516, 0.545] | 0.529 [0.520, 0.539] | 0.602 [0.589, 0.615] | 0.661 [0.648, 0.673] |
| <40 | 223 / 1,365 | 0.537 [0.504, 0.568] | 0.564 [0.531, 0.595] | 0.554 [0.532, 0.577] | 0.607 [0.572, 0.641] | 0.685 [0.652, 0.716] |
| 40–<80 | 854 / 5,548 | 0.533 [0.516, 0.551] | 0.519 [0.501, 0.538] | 0.531 [0.519, 0.543] | 0.614 [0.598, 0.630] | 0.667 [0.652, 0.683] |
| 80–<100 | 270 / 1,835 | 0.521 [0.489, 0.553] | 0.533 [0.502, 0.565] | 0.516 [0.495, 0.538] | 0.579 [0.546, 0.611] | 0.641 [0.611, 0.668] |
| 100–<120 | 75 / 533 | 0.493 [0.422, 0.560] | 0.556 [0.489, 0.622] | 0.493 [0.452, 0.532] | 0.542 [0.476, 0.609] | 0.600 [0.538, 0.658] |
| 120+ | 6 / 44 | 0.556 [0.444, 0.667] | 0.500 [0.278, 0.667] | 0.464 [0.345, 0.592] | 0.556 [0.444, 0.667] | 0.556 [0.278, 0.778] |

Spearman rank correlation uses the same typists and cells shown above. L2's constant ranks give an undefined correlation in every band.

| Source WPM | L0 | L1 | L3 | L5 |
| --- | --- | --- | --- | --- |
| All | -0.001 [-0.026, 0.023] | 0.011 [-0.012, 0.037] | 0.226 [0.203, 0.249] | 0.365 [0.342, 0.388] |
| <40 | -0.028 [-0.088, 0.030] | 0.044 [-0.017, 0.104] | 0.241 [0.179, 0.303] | 0.386 [0.321, 0.446] |
| 40–<80 | 0.008 [-0.025, 0.039] | -0.018 [-0.049, 0.013] | 0.246 [0.215, 0.276] | 0.369 [0.341, 0.399] |
| 80–<100 | -0.004 [-0.058, 0.051] | 0.023 [-0.030, 0.075] | 0.183 [0.132, 0.234] | 0.342 [0.286, 0.396] |
| 100–<120 | -0.024 [-0.118, 0.064] | 0.197 [0.091, 0.309] | 0.115 [0.012, 0.212] | 0.352 [0.255, 0.446] |
| 120+ | 0.285 [0.114, 0.457] | 0.143 [-0.069, 0.347] | 0.141 [-0.164, 0.402] | 0.227 [-0.079, 0.536] |

## Coaching decisions and prediction ranges

L5 suggests the practiceable pair with the greatest expected lost time after its posterior probability of a gap above 10% clears 95%. For 378 of the 478 early suggestions, fewer than two later clean observations were available. Of the 100 checkable suggestions, 76 met the later gap criterion. The pointwise posterior probability concerns a latent gap. The confirmation rate concerns an observed mean from a second, short history.

Stability counts agreement among everyone who received a suggestion in either half. Only 61 people received suggestions in both halves, and 13 of those received the same pair. The nominal 80% range covers the later **mean log interval** on the primary scoring cells. A dash marks an empty denominator. A degenerate bootstrap interval, such as six hits in six observations, reflects the observed sample's lack of variation.

| Source WPM | Yield % | Issued / checkable / hits | Hit % | Same / either half | Stability % | 80% coverage % |
| --- | --- | --- | --- | --- | --- | --- |
| All | 2.9 [2.6, 3.1] | 478 / 100 / 76 | 76.0 [67.0, 84.0] | 13 / 1,007 | 1.3 [0.6, 2.0] | 82.3 [81.4, 83.2] |
| <40 | 2.4 [2.0, 2.8] | 137 / 20 / 13 | 65.0 [45.0, 85.0] | 1 / 301 | 0.3 [0.0, 1.0] | 80.1 [78.0, 82.2] |
| 40–<80 | 2.6 [2.3, 2.9] | 249 / 58 / 43 | 74.1 [62.1, 86.2] | 7 / 548 | 1.3 [0.4, 2.4] | 82.5 [81.4, 83.6] |
| 80–<100 | 5.6 [4.4, 7.0] | 72 / 16 / 14 | 87.5 [68.8, 100.0] | 3 / 133 | 2.3 [0.0, 5.3] | 84.9 [82.9, 86.7] |
| 100–<120 | 9.3 [5.6, 13.4] | 20 / 6 / 6 | 100.0 [100.0, 100.0] | 2 / 25 | 8.0 [0.0, 20.0] | 80.7 [75.8, 85.0] |
| 120+ | 0.0 [0.0, 0.0] | 0 / 0 / 0 | — | 0 / 0 | — | 85.1 [70.8, 95.8] |

Yield by number of earlier clean sentences is shown as a percentage with a 95% interval and the group size in parentheses. A single typist gives a point estimate only.

| Source WPM | 0 | 1 | 2 | 3–4 | 5+ |
| --- | --- | --- | --- | --- | --- |
| All | 0.0 [0.0, 0.0] (6,918) | 0.7 [0.4, 1.0] (3,204) | 3.5 [2.8, 4.2] (2,758) | 7.6 [6.6, 8.6] (3,069) | 17.5 [14.6, 20.4] (710) |
| <40 | 0.0 [0.0, 0.0] (3,070) | 0.8 [0.4, 1.4] (1,091) | 4.3 [3.0, 5.8] (740) | 11.5 [8.9, 14.0] (627) | 23.5 [15.7, 32.4] (102) |
| 40–<80 | 0.0 [0.0, 0.0] (3,517) | 0.7 [0.3, 1.1] (1,944) | 3.3 [2.4, 4.1] (1,722) | 6.3 [5.3, 7.4] (1,909) | 13.8 [10.7, 17.1] (428) |
| 80–<100 | 0.0 [0.0, 0.0] (288) | 0.6 [0.0, 1.9] (155) | 3.2 [1.2, 5.5] (253) | 8.1 [5.6, 10.8] (444) | 20.0 [14.1, 26.7] (135) |
| 100–<120 | 0.0 [0.0, 0.0] (39) | 0.0 [0.0, 0.0] (13) | 2.6 [0.0, 7.7] (39) | 6.0 [1.2, 12.0] (83) | 33.3 [19.0, 47.6] (42) |
| 120+ | 0.0 [0.0, 0.0] (4) | 0.0 (1) | 0.0 [0.0, 0.0] (4) | 0.0 [0.0, 0.0] (6) | 0.0 [0.0, 0.0] (3) |

There were 392,795 clean training sentences among 93,478 typists with a clean sentence, or 4.20 each. Across all 134,975 assignments the average was 2.91. In validation, only 25.2% of assigned typists had a repeated pair in both halves. The error estimates describe those repeatable pairs and disproportionately cover typists with longer clean histories. Longer app histories can accumulate more repeated pairs, but the yield and stability for daily use need longitudinal measurement. Whether targeted practice improves typing requires a practice trial.

## Speed support and the D10 stress test

The central 98% of pair-mix-adjusted training speeds among 83,710 typists with at least 20 intervals spanned **80.4–376.3 ms** on the exponentiated log scale. Beyond either end the pair pattern stays at the boundary and the typist's own level continues. Of the 14 typists at 120+ WPM with an earlier interval, 11 were outside support. The runtime rule uses the user's intervals. Source WPM supplies only these bands and the experimental cutoff.

Withholding the 100+ group from the speed fit removed 1,544 training typists with clean intervals. The paired cost below is restricted-fit MAE minus full-fit MAE on identical later cells. The full-fit noise and gap variances are shared.

| Source WPM | Scored typists / cells | L2 full / restricted | L2 cost | L5 full / restricted | L5 cost |
| --- | --- | --- | --- | --- | --- |
| 100+ | 143 / 696 | 0.2084 / 0.2104 | 0.0020 [0.0012, 0.0029] | 0.1897 / 0.1907 | 0.0011 [0.0006, 0.0016] |
| 100–<120 | 133 / 641 | 0.2084 / 0.2106 | 0.0022 [0.0014, 0.0031] | 0.1892 / 0.1903 | 0.0012 [0.0006, 0.0017] |
| 120+ | 10 / 55 | 0.2078 / 0.2073 | -0.0005 [-0.0029, 0.0019] | 0.1962 / 0.1957 | -0.0005 [-0.0023, 0.0011] |

The fastest clean training typist was at 152.6 WPM and the fastest scored validation typist at 147.2. Only ten 120+ typists contributed to MAE and six to the rankings. Their paired L5 gain over L1 was 0.0465 [0.0064, 0.0792], with a lower endpoint below the 0.020 margin. No participant approached 190 WPM. At that speed the boundary pattern is an extrapolation. The conditional prediction range omits uncertainty about that pattern, so its accuracy needs checking against the user's subsequent clean typing.

## D2 secondary comparison

Adding the earlier corrected-sentence intervals admitted by B3's nine-stroke window lowered MAE on the same later clean cells by 0.0036 log ms. The gain fell below the 0.020 criterion for considering an eligibility change. The augmented coach issued 1,298 suggestions, and 241 were checkable. Different recommendation sets contribute to the two hit rates. The fresh registration retains clean-copy histories.

| Source WPM | Augmented MAE | Paired gain over clean | Yield % | Issued / checkable / hits | Hit % |
| --- | --- | --- | --- | --- | --- |
| All | 0.202 [0.199, 0.207] | 0.0036 [0.0025, 0.0047] | 7.8 [7.4, 8.2] | 1,298 / 241 / 178 | 73.9 [68.5, 79.7] |
| <40 | 0.217 [0.206, 0.228] | 0.0033 [0.0003, 0.0062] | 7.5 [6.9, 8.3] | 425 / 64 / 40 | 62.5 [50.0, 75.0] |
| 40–<80 | 0.200 [0.195, 0.206] | 0.0037 [0.0024, 0.0052] | 7.5 [7.0, 8.0] | 712 / 133 / 98 | 73.7 [66.1, 81.2] |
| 80–<100 | 0.196 [0.186, 0.207] | 0.0027 [0.0003, 0.0050] | 10.2 [8.5, 12.0] | 130 / 31 / 28 | 90.3 [80.6, 100.0] |
| 100–<120 | 0.183 [0.166, 0.203] | 0.0058 [0.0020, 0.0098] | 13.9 [9.3, 18.5] | 30 / 12 / 11 | 91.7 [75.0, 100.0] |
| 120+ | 0.190 [0.141, 0.243] | 0.0065 [0.0003, 0.0135] | 5.6 [0.0, 16.7] | 1 / 1 / 1 | 100.0 |

## Reproduction and handoff

Branch `OwenC05/tf-coach-model`. The implementation and scorer are pinned to `f9fe277e179d8acc97e0e44742156b8d5579ae8e`. The registration and validation JSON are committed at `015e9d0`. Resolve the final report revision with `git log -1 --format=%H -- ml/coach/REPORT.md`.

The registration SHA256 is **`b02c11bae561d7a6fef0f071e73b1c04969e534d545014a6ad1f2be772edcfde`** over Git LF bytes. The aggregate JSON SHA256 is `61c68ea50899e483f686b51caab1201e67f22e23f4e085e969c4b645a10da733`. The registration lists the four verified B3 input hashes, both published feature inputs and the exact fitted-parameter digest. [Input and parameter identities](PREREG.md#identity-and-execution)

```sh
export OPENBLAS_NUM_THREADS=1 PYTHONDONTWRITEBYTECODE=1
coach_python=/mnt/c/Users/Owenc/Documents/GitHub/TypeForge/.venv/bin/python
coach_data=/home/owenc/typeforge-data/aalto-136m/dataset-v2
coach_meta=c840a716251a6f8cb435774ddb04a4ebbf4b9a3b28e91fb69cbeb2b14aa3da80
"$coach_python" -m ml.coach.validation "$coach_data" "$coach_meta" ml/coach/validation.json
"$coach_python" -m unittest discover -s ml/tests
```

The suite passed 53/53, including 11 coach tests. A second single-thread fit and replay reproduced every aggregate and the fitted-model digest exactly. An independent vectorized calculation reproduced the scoring masks, L1 and L5 MAE, issued suggestions and hits in all six groups. Pyright reported zero errors and warnings with basic types and unused-code checks. A later optional `tabnanny` command timed out at WSL startup (0x8007274c). Native checks passed for tabs, trailing whitespace and the 100-column limit. B5's independent review is the next gate for B6.
