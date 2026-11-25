# TypeForge coaching model · fresh-test registration

## Decision and population

L5 passes when **at least 800 fresh typists** have a qualifying cell and the **lower endpoint** of the paired 95% participant-bootstrap interval for `MAE(L1) − MAE(L5)` exceeds **0.020 natural-log milliseconds**. The margin represents about a 2% improvement in the multiplicative absolute-error factor. At 800 typists the validation paired SD of 0.143 implies an approximate 95% half-width of 0.010. Fewer than 800 gives `fail_insufficient_data`. With enough typists, a lower endpoint at or below the margin fails. Subgroups and all secondary comparisons are descriptive.

A pass establishes that L5 predicts a typist's later pair timing better than their own average by the registered margin. That authorizes L5 to choose the coach's pairs in TypeForge and in a practice trial. Only a prospective practice trial can establish whether practising those pairs improves typing or whether L5's choices outperform the current rule.

The unit is a keydown-to-keydown interval between adjacent lowercase ASCII letters in a clean-copy trial under B3's A2 rule. Use natural log milliseconds throughout. Test once on the fresh A8 assignment excluding all 2,000 original participants. B5 reviews this registration and scorer before B6 opens that assignment. The train and validation partitions and all model choices stay fixed.

## Chronology and scoring mask

- Order **all** replayed trials by the B3 chronological index, including rejections. For `T` trials, orders 0 through `floor(T/2)−1` form the earlier half. The rest form the later half. Preserve the full assigned roster for yield, including typists with no usable history.
- Freeze predictions and the suggested pair at the midpoint. Personal features use only earlier eligible data. `AVG_WPM_15` uses the entire session and is reserved for subgroup reporting and the training-cut experiment.
- A scored cell is one typist and one of the 676 pairs with **at least two clean observations in each half**. Two requires a recurrence on each side while retaining sparse histories. The observed target is the arithmetic mean of the later **logs**. Every rung uses precisely these cells.
- For each typist average the absolute errors across qualifying pairs, giving each pair equal weight. Average those errors equally over typists with at least one qualifying cell. Average paired differences within the very same typists.

## Model fit

Use WSL Python 3.14.4, NumPy 2.5.3 and SciPy 1.18.1 with `OPENBLAS_NUM_THREADS=1`. Fit the full clean train once. All training moments use binary64. Pair index is `26 * first + second` with zero-based alphabet indices.

1. L0 is the interval-weighted train mean for the pair, with the pooled interval mean `g` for an unseen pair. L1 is the typist's unadjusted mean of all earlier clean log intervals, falling back to `g` with no history.
2. Initialize each pair anchor `a` with its total plus 20 pseudo-observations at `g`, divided by its count plus 20. Run four additive-centering passes. Compute each train typist's mean of `y−a[p]`, subtract those offsets from the pair totals observation by observation, shrink again with 20 at `g`, and shift anchors to interval-weighted mean `g`. Unseen anchors take `g`.
3. Personal speed is `s = g + mean(y−a[p])` over the available history. An empty history takes `g`. The support endpoints are the unweighted 1st and 99th percentiles of training speeds among typists with at least 20 clean intervals (linear quantiles).
4. Set `h = clip(s, low, high)`, `x = h−g`. Fit each pair's slope through its anchor by weighted least squares on individual intervals after subtracting `s−h`. Shrink slopes toward 1 with penalty `20 * max(interval-weighted mean(x²), 1e−8)`. The L2 expectation is `mu = a[p] + b[p]*x + (s−h)`. Beyond either boundary the pair pattern stays at the boundary and the user's observed level continues with unit slope. The same posterior and suggestion rule apply there.
5. Estimate `sigma²[p]` from within-typist/pair sums of squares divided by pooled residual degrees of freedom, adding 20 degrees at the global pooled variance. Floor at `1e−6`. For cells with at least two observations, subtract `sigma²[p]/n` from the squared gap of the cell mean from L2. Estimate `tau²[p]` as the unweighted mean of that signal across those typists, adding 20 cells at the pooled signal. Floor the pooled and final variance at `0.05²`.
6. L5 assumes `d ~ Normal(0, tau²[p])` and observation variance `sigma²[p]`. For personal count `n` and log sum `S`, `V = tau²*sigma²/(sigma²+n*tau²)`, `d_hat = tau²*(S−n*mu)/(sigma²+n*tau²)`. Predict `mu+d_hat`. Each eligible sentence updates counts and log sums. Recompute personal speed and all gaps from those totals.
7. L3 uses the published intercept and all 682 folded Ridge coefficients. At the cutoff construct its last-ten-interval-bearing-sentence history. For each scored pair average its frozen prediction over that pair's earlier word lengths and relative positions. Linearity gives the same value as averaging dense feature predictions. All rungs have access to the same early stream. A diagnostic also scores the typist's raw earlier target-pair mean on the common mask.

## Replay and secondaries

- A coach candidate must be in A3's 100 practiceable pairs, have at least two earlier observations and satisfy `Pr(d > log(1.10)) > 0.95`. This is a pointwise, model-conditional probability. Rank passing pairs by `1000*f_p * exp(mu+sigma²[p]/2) * expm1(d_hat)`, with `f_p` the corpus frequency per character. Return one pair, breaking exact ties by alphabetic pair index. An empty set means abstention.
- **Matched reference.** Independently in each half, the reference acts only where L5 issues. Among the same 100 bank pairs with at least two observations and a nonempty complement, choose the largest raw mean log interval minus the mean of **all other clean intervals** in that half. Break exact ties alphabetically. Abstain if none qualifies. This descriptive reference compares rankings at matched issuance and has no role in the primary decision.
- For independent later labels, compute later pace from the clean later half alone and apply the frozen full L2. The observed gap is the later pair mean minus that expectation. **Hit rate** is the fraction of issued suggestions with a later gap above `log(1.10)` among suggestions with at least two later observations. Report issued and adjudicable counts. A missing later pair has an unknown outcome.
- For each rule report assigned, issued, adjudicable, hits and unknowns (issued minus adjudicable). Give the possible all-issued hit fraction from `hits/issued` to `(hits+unknowns)/issued`, or unavailable for zero issued. Report the number assigned with a bank pair observed at least twice. Yield is issued divided by assigned. Also report L5 yield for 0, 1, 2, 3–4 and 5+ earlier eligible sentences, including clean sentences with zero intervals.
- Report the same-pair count divided first by typists receiving a suggestion in **either** half and then by those receiving one in **both** halves, for each rule. For the paired difference in confirmed hits per assigned typist, give each rule one for a confirmed early pick and zero for every other assignment. Subtract the reference indicator from L5's within each typist and bootstrap that difference over the full roster. An unknown contributes zero confirmed hits and retains its unknown status.
- With at least four common cells, rank **personal** gaps. Each rung's predicted gap subtracts the full early L2 expectation. Rank against the observed later gaps. Precision at three is expected top-three overlap divided by three, allocating boundary ties fractionally. Spearman uses midranks and excludes a typist if either rank vector is constant.
- Nominal 80% coverage is the participant-macro share of later cell means within `mu+d_hat ± 1.2815515655 * sqrt(V+sigma²[p]/m)`, where `m` is the later clean count. This conditional predictive range treats the estimated speed as fixed. L5 supplies the ranges and decisions.
- Report overall and by source WPM bands below 40, [40,80), [80,100), [100,120) and 120+. Include assignment, scoring and metric-specific denominators. The overall group retains missing WPM if present. A missing estimate is unavailable.
- Use 2,000 same-size bootstrap draws with replacement over qualifying typists, NumPy `default_rng(20261124)`, 2.5th/97.5th percentiles with linear interpolation. Conditional metrics resample their own denominators. Paired contrasts resample within-typist differences. One typist has no bootstrap interval and constant samples have coincident bootstrap endpoints.
- Alongside the bootstrap interval for **each participant-level binary rate**, give successes, denominator and its two-sided 95% Clopper–Pearson interval (equal 2.5% tails, including zero or one successes out of one). A zero denominator has no rate or interval. Coverage and rank summaries are participant means of fractions. The paired confirmed-hit difference can take negative values. These use participant-bootstrap intervals.
- **D10 speed stress test.** Refit anchors, center, slopes and support using only training typists with source WPM below 100. Retain full-fit variance components to isolate the speed fit. Report full and restricted L2/L5 MAE and paired restricted-minus-full cost on the same held-out 100+ typists, also splitting [100,120) and 120+. The lower cut preserves a practicable high-speed cohort.
- **D2 validation-only secondary.** Update L5's personal speed and gap from clean plus B3's corrected-sentence intervals in the earlier half. Keep population parameters, clean later targets, labels and the original clean scoring mask identical. Compare paired MAE, yield and adjudicable hit rate. A lower 95% bound above 0.020 for clean-minus-augmented MAE would warrant considering a separate eligibility change. Fresh scoring uses clean-copy histories.

## Identity and execution

The original decisions were recorded in `89335e4`. B5 review `d8b4da2` and coordinator ruling D12 in `0b7c7cf` precede this amendment. B5 rechecks it before B6 opens the fresh assignment. Use the integrated checkout with the following Git revisions.

| Component | Git revision |
| --- | --- |
| B3 builder `ml.dataset_v2._build_split` | `c5dcd6258251fb05fdf85b570a7b678335b89e4d` |
| Population fit, model and `score_split` entry point | `f9fe277e179d8acc97e0e44742156b8d5579ae8e` |
| Amended replay, reference, exact intervals and primary decision | `493aee5d20c9a1bb80c826623f96f489a09dc170` (decision logic introduced at `1061c655137596c873872a63da919bf0a9fa1556`) |
| B6 driver `ml.coach.b6` and validation reference JSON | `493aee5d20c9a1bb80c826623f96f489a09dc170` |

**B6 command after approval**, from the repository root in WSL.

```sh
OPENBLAS_NUM_THREADS=1 /mnt/c/Users/Owenc/Documents/GitHub/TypeForge/.venv/bin/python -m ml.coach.b6 fresh /home/owenc/typeforge-data/aalto-136m /mnt/c/Users/Owenc/Documents/GitHub/TypeForge/ml/data/raw/metadata_participants.txt /home/owenc/typeforge-data/aalto-136m/coach-fresh-results.json
```

The driver verifies the registered source files, manifests, selected roster, metadata, train, corpus, Ridge and fitted digest. Join WPM by participant ID in the verified roster's lexical order. Absent, unparseable and nonfinite speeds become NaN. Forward all manifest shard entries in their original order to B3's `_build_split(pool, snapshot, entries, stage, "test", speeds, [])`. B3 checks each selected shard hash. The derived clean NPZ is temporary.

Before scoring, the driver publishes the derived SHA256 in `<output>.input.sha256`. It opens the NPZ with `allow_pickle=False`, calls `score_split(model, limited, ridge, frequency, data)` once, and publishes the complete JSON at the requested path. Both output names are exclusive. Validation mode uses the same steps on the validation roster, verifies the exact clean NPZ bytes and checks every non-D2 result against the pinned validation JSON.

All digests below are SHA256. Version-controlled text uses Git LF bytes. The candidate-list digest is UTF-8, one pair followed by LF, in A3's published list order.

| Input | Digest |
| --- | --- |
| A8 ingest manifest | `ddb00d980b28ea2653b15d27010df051a23f37ce197d78228b175027d8fd528c` |
| A8 split manifest | `36e3e0db0db4f5d5877504a1fefe0c8ce7948a156a392aefa94ee13835732be8` |
| Train assignment | `c0e55bb0837f4fd4af2bede744f16128b19c270ceb538047166515577e3c53db` |
| Validation assignment | `bf8b847824a3ec8f21b4982bb7bd3c4207fb5393f4b98e769237a381df1dff48` |
| Fresh assignment, from A8's published manifest | `08bea7236ee36461e239e6190e02ff9c893b067733ed8ae7078c3bf6a6f69699` |
| B3 `meta.json` | `c840a716251a6f8cb435774ddb04a4ebbf4b9a3b28e91fb69cbeb2b14aa3da80` |
| B3 `train.npz` | `4ee076d14840e8ef9d5f8c69e2a35b20618567a44316e84df2003a28b4cc7b16` |
| B3 `validation.npz` | `1924228510dbf4a84c93f2d097bddd2e7503b3455c8a7762d350bea4f5dbed94` |
| B3 `validation-corrected.npz` | `2f6bba780a28549f2993c48b774c0b0c967f51b4bc7c70ed79e32017e8b39dd3` |
| Source `raw/metadata_participants.txt` | `3ba22e2c23dbcbb5645197b9dd68c17e9ef68a1be7170e1bc1f0cd869a68ac6d` |
| A3 pair frequencies | `73053fe706308e95a04052ba8fe19dfaecb00079104f46af9cd2b6a31c9d1327` |
| A3's 100 candidate pairs in that file | `3d457a043b5bd1473d52c64a89dcfa261993f2aa549b7013788161cd9339e8d5` |
| Frozen Ridge | `7ffce48105ac2dc9c9915d01f9277a7f4b7cfeca6d0377ce8d44a8d70536a836` |
| Fitted full model | `c813005bd99f23fc88b9370490eb8dffa1792c57d5151d23b07047477fe85158` |
| Validation reference `ml/coach/validation.json` | `ef88838cd24c4edde0eecb9967239cee9b94847b6dddc2766d250b18687f88b0` |
| B3 `ml/dataset_v2.py` | `b5281e63df79f62ddda6ed2ef88f94fefabc1d603dd29ff8b1daa52c76cdf6ae` |
| `ml/coach/model.py` | `7a28fd849d0d8206cb529f15bddde0b2cf6433f3b8205c521ee1765cc9646de2` |
| `ml/coach/replay.py` | `122f9496f9297150c2396f32a2aa2f848752ddcc1ce651befd8f0705656a370f` |
| `ml/coach/validation.py` | `2485200744c574b2bc76c323d4970b42b00a73dc792d7901f3fc4ab2bf8d9784` |
| `ml/coach/b6.py` | `5d30ba5df928b15e71d4db563aaa12f86c0d76b380a3a2cba03428d57ea79bde` |

The fitted-model digest uses concatenated little-endian float64 values beginning with center, low and high, followed by the arrays of L0 pair means, anchors, slopes, gap variances and residual variances. Array order is `aa` through `zz`. B6 verifies the digest and input hashes before scoring. The full center is 4.991806588457015 and the support is [4.3868277835121745, 5.9303363670890565] log ms. The below-100 fit has center 5.00703192871013 and support [4.431611285801627, 5.933951603104741].
