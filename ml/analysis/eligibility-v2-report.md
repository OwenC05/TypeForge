# Can corrected sentences supply ordinary pair timings?

**Use the clean-copy fallback for metric v2.** None of 36 tested correction/error windows established timing equivalence across speed bands and retained distances. Across 1,700 development participants, v2 admits **100,906 intervals**, with a median of **65** on the probe population and **63 typists** reaching 200 intervals. [Exact rule](../specs/eligibility-v2.md)

## Design

The source was the pinned 2,000-typist Aalto acquisition. SHA-256 ranking at seed 42 assigned 1,400 train and 300 validation participants to this analysis. We opened zero test keystroke files. We verified the manifest, shared metadata and each of 1,634 qualifying dev log files against their input hashes. The layout/keyboard screen omitted 66 participants and 20 files failed parsing. Of 24,210 trials, 4,981 had a verified clean copy and 9,993 had a verified nonclean replay, including corrected copies and still-incorrect submissions. The rest failed source checks. [Aggregate counts and SHA-256 digests](eligibility_v2_bias.json)

We compared each scored log interval with the same typist's mean log milliseconds for the same **intended** pair on clean sentences. Within each typist we ranked measurable clean and nonclean trials separately by a seeded hash of participant and section, then alternated trials into two folds. A sentence was scored only against clean trials in the opposite fold. A typist's sole clean sentence could supply references for disjoint nonclean trials. Pairs without an observed clean reference contributed to yield alone. Of 182,079 first-attempt candidate intervals in nonclean trials, 43,307 (23.8%) had a reference, across 1,170 typists.

For each cell we averaged matched residuals within typist, then weighted contributing typists equally. The reported effect is `100 × (exp(mean log residual) − 1)`. Positive values mean slower typing. Intervals in brackets are pointwise 95% percentile intervals from 2,000 seeded resamples of typists with replacement. Effects require at least two typists. Speed uses the source's `AVG_WPM_15` with lower-inclusive bands. [Analysis code](eligibility_v2_bias.py)

## Timing around a correction

A disruption begins when a key first deviates from a correct prefix or a Backspace occurs. The end of a tail correction is operationally the last Backspace before the correct prefix resumes. Post distance counts the left endpoint's keystroke ordinal after that Backspace. Distance one is the pair between the first two subsequent inserts. Pre distance counts strokes from the right endpoint to the next disruption. Distance one means the next key is the mistake. All literal inserts, including spaces and punctuation, count toward distance. Shift is transparent.

The table includes correctly retyped endpoints to measure immediate post-correction behavior. The promotion test below requires both endpoints to be first attempts. A wrong-key interval runs from a clean left key to the erroneous press, compared with the intended target pair. Physical pair identity may differ on that press.

| Interval | Typists overall | All WPM, % [95% CI] | <40 | 40–<80 | 80–<120 | 120+ |
| --- | ---: | --- | --- | --- | --- | --- |
| Held-out clean | 966 | -0.1 [-0.4, 0.2] | 0.0 [-0.6, 0.6] | -0.1 [-0.5, 0.2] | -0.3 [-1.0, 0.3] | 0.6 [0.4, 0.8] |
| Ends on wrong key | 755 | 27.4 [22.5, 32.9] | 20.3 [11.1, 30.6] | 29.2 [22.7, 35.9] | 40.7 [22.4, 60.1] | — |
| After Backspace 1 | 767 | 6.0 [2.5, 9.6] | 1.0 [-5.7, 8.0] | 7.6 [3.3, 12.1] | 11.5 [-0.9, 26.6] | — |
| After Backspace 2 | 762 | 6.1 [2.8, 9.5] | 2.4 [-4.4, 9.3] | 7.6 [3.7, 11.8] | 7.2 [-2.9, 18.3] | — |
| After Backspace 3 | 759 | 0.4 [-2.7, 3.4] | -0.6 [-6.5, 6.0] | 1.2 [-2.5, 5.0] | -2.1 [-10.7, 7.3] | — |
| After Backspace 4 | 752 | 2.4 [-0.8, 6.1] | 0.6 [-6.3, 8.2] | 3.1 [-0.7, 7.3] | 2.8 [-6.7, 15.0] | 29.3 [16.7, 43.3] |
| After Backspace 5-9 | 1,066 | 0.0 [-1.8, 1.8] | -2.3 [-5.6, 1.0] | 1.1 [-1.4, 3.7] | -0.2 [-4.8, 4.7] | — |
| After Backspace 10+ | 1,095 | 2.0 [0.7, 3.3] | 3.4 [0.4, 6.3] | 1.6 [-0.1, 3.2] | 0.3 [-3.4, 4.3] | — |
| Before error 1 | 800 | 0.1 [-2.9, 3.2] | 0.2 [-5.6, 6.5] | -0.5 [-4.1, 3.2] | 4.8 [-6.4, 16.7] | — |
| Before error 2 | 879 | -0.8 [-3.3, 1.9] | -0.3 [-5.7, 5.5] | -1.3 [-4.6, 2.2] | 0.3 [-6.7, 8.0] | — |
| Before error 3 | 830 | 2.5 [-0.5, 5.6] | 2.8 [-2.8, 9.2] | 2.1 [-1.6, 5.9] | 3.5 [-7.8, 17.0] | — |
| Before error 4 | 792 | 0.3 [-2.9, 3.5] | -0.1 [-6.2, 6.4] | -0.9 [-4.6, 2.7] | 12.1 [2.1, 22.7] | -6.4 [-10.8, -1.7] |
| Before error 5-9 | 1,111 | 1.9 [0.2, 3.6] | 4.1 [0.8, 7.8] | 1.1 [-1.0, 3.1] | 0.5 [-4.5, 5.5] | -21.2 [-35.8, -3.2] |
| Before error 10+ | 1,136 | 0.4 [-0.8, 1.7] | -1.7 [-4.6, 1.2] | 1.1 [-0.3, 2.6] | 2.6 [-1.2, 6.0] | 1.0 [-22.5, 31.6] |

The first two post-Backspace intervals averaged about 6% slower. The last correctly typed pair before a wrong key had an estimated effect of +0.15% [−2.87, +3.23]. A separate diagnostic for a correct pair immediately before a Backspace found +16.6% [−6.0, +48.2], based on 45 typists. This measures the last letter pair before deletion. Backspace itself supplies no lowercase-pair timing. Every cell's typist count, interval count, and the six pre-deletion buckets are in the JSON. The 120+ column has at most two typists. A dash means fewer than two. [Full estimates](eligibility_v2_bias.json)

## Window decision

For each side independently we tried excluding the nearest 0, 1, 2, 3, 4 or 9 strokes. An absent prior correction or future disruption imposes no distance exclusion. Every candidate already requires two consecutive first-attempt lowercase letters on the correct prefix. The pre window protects against both a wrong key and a deletion of correct text. Windows operate on the intersection of these conditions.

Our engineering tolerance required the **entire** 95% interval for new evidence to lie in **[−2%, +2%]** overall, in each contributing speed band, and in each retained marginal pre and post distance bucket (including no disruption on that side). This tests the proposed additions directly, without diluting their effect with clean-sentence observations. We would choose the passing window with the highest additional yield. Eleven windows passed the pooled check. All eleven failed the speed and distance checks.

The widest tested exclusion, nine strokes on both sides, would add 95,524 intervals. Only 23,772 could be matched to a clean pair reference. Its retained timing was as follows.

| WPM | Matched typists | Matched intervals | Effect, % [95% CI] |
| --- | ---: | ---: | --- |
| All | 1,160 | 23,772 | 1.0 [-0.1, 2.2] |
| <40 | 339 | 5,741 | -0.1 [-2.7, 2.4] |
| 40–<80 | 700 | 15,275 | 1.24 [-0.02, 2.48] |
| 80–<120 | 119 | 2,709 | 2.9 [-0.3, 6.1] |
| 120+ | 2 | 47 | 4.3 [-17.3, 31.6] |

Even in that window, the retained post-10+ bucket was +1.95% [+0.43, +3.55], and intervals with no later disruption were +2.14% [+0.68, +3.69]. The evidence leaves uncertainty about ordinary timing beyond the immediate correction. The selected rule therefore excludes a whole nonclean sentence.

## Yield on the probe population

Every row uses the same denominator across rules, including zeros. It is the union of typists with any v1 or unguarded probe interval, with reserved prompts included. Each cell gives **intervals / median per typist / typists with at least 200**.

| WPM | Typists | v1 | Probe excluding first post interval | Selected v2 |
| --- | ---: | ---: | ---: | ---: |
| All | 1,292 | 100,978 / 65 / 63 | 289,087 / 233 / 853 | 100,906 / 65 / 63 |
| <40 | 413 | 22,132 / 39 / 7 | 83,954 / 210 / 226 | 22,089 / 39 / 7 |
| 40–<80 | 751 | 62,987 / 71 / 37 | 174,928 / 242 / 535 | 62,958 / 71 / 37 |
| 80–<120 | 126 | 15,445 / 126 / 18 | 29,663 / 237 / 91 | 15,445 / 126 / 18 |
| 120+ | 2 | 414 / 207 / 1 | 542 / 271 / 1 | 414 / 207 / 1 |

The raw-TSV replication gives 297,093 intervals with the unguarded probe. The probe variant that also removes the first interval after a correction yields 289,087 (2.86× v1 and 3.79× v1 below 40 WPM). Its median is 233. Both probe variants can count retyped positions. The selected v2 rule admits 1,177 typists with any interval, compared with 1,179 under v1. Its source checks discard 60 former v1 intervals in trials with unsupported editing/control keys and 12 with untracked input.

## Limits and integration

Aalto records keydown names and the submitted string. Several editing histories can yield the same final string. It lacks native browser selections, beforeinput/input events, focus and repeat flags. Clean-pair reference coverage is sparse, especially above 120 WPM. Word context, prompt difficulty and which sentences each person copied cleanly can affect the residuals. The 36-window search is exploratory. These measurements describe typing in this sample and leave browser behavior, model accuracy and practice efficacy unmeasured. Data by Vivek Dhakal, Anna Maria Feit, Per Ola Kristensson and Antti Oulasvirta. [Aalto source paper](https://doi.org/10.1145/3173574.3174220)

- **B1** should call the Aalto adapter and consume only `eligible(...).intervals`, retain source rejection counts, version the training data and restart v2 histories. Corrected-trial timing can be reconsidered on development participants from the larger archive.
- **B2** should apply the same clean-copy rule at sentence closure, including edit, cursor, timing and final-value checks. Run the 32 shared fixtures in TypeScript, add real browser event-reconciliation checks, and isolate v2 records, predictions and baseline membership. [Browser mapping](../specs/eligibility-v2.md)

## Reproduction

Run the audit from the repository root in WSL with Python 3.14.4 and NumPy 2.5.3.

```bash
set -o pipefail
export OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1
py=/mnt/c/Users/Owenc/Documents/GitHub/TypeForge/.venv/bin/python
data=/mnt/c/Users/Owenc/Documents/GitHub/TypeForge/ml/data
"$py" -B -m ml.analysis.eligibility_v2_bias "$data" | sha256sum
"$py" -B -m unittest discover -s ml/tests -v
```

The SHA-256 of the 26,687-byte LF summary is `a0c77973c9c80d354ed032f7eadc8dc3e162ec2bef1a15c38e26b23c677c9d07`. A clean export of the committed source reproduced the Git blob byte-for-byte in 30.0 s. A separate worktree process took 31.1 s. Default Windows Git archive settings added CRLF to the exported reference, so the byte check used the canonical LF blob.

The full ML suite passed 30/30 tests, including 32 shared fixture subcases. Branch `OwenC05/tf-eligibility-v2` carries analysis and reference commit `4dc3e1a68aef6b28cd3a2812d6cbf5cef601f086`. To print the final A2 report commit SHA, run `git log -1 --format=%H -- ml/analysis/eligibility-v2-report.md`.
