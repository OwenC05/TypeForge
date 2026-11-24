# TypeForge coaching model · fresh-test registration

## Decision and population

The candidate is L5, a pair-by-speed expectation plus a shrunken personal gap. Success requires the **lower endpoint** of a paired 95% participant-bootstrap interval for `MAE(L1) − MAE(L5)` to exceed **0.020 natural-log milliseconds**. A difference of 0.020 corresponds to about a 2% improvement in the multiplicative absolute-error factor and rules out a negligible average gain. A lower endpoint at or below the margin, or insufficient data for the interval, fails the gate. Secondary results inform product decisions and cannot rescue the primary result.

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
- For independent later labels, compute later pace from the clean later half alone and apply the frozen full L2. The observed gap is the later pair mean minus that expectation. **Hit rate** is the fraction of issued suggestions with a later gap above `log(1.10)` among suggestions with at least two later observations. Report issued and adjudicable counts. A missing later pair has an unknown outcome.
- Yield is issued suggestions divided by assigned typists. Also report it for 0, 1, 2, 3–4 and 5+ earlier eligible sentences, counting a verified clean sentence even when it contains zero eligible intervals. Stability is agreement of the two independent top suggestions among typists receiving one in at least one half. A one-sided abstention scores zero.
- With at least four common cells, rank **personal** gaps. Each rung's predicted gap subtracts the full early L2 expectation. Rank against the observed later gaps. Precision at three is expected top-three overlap divided by three, allocating boundary ties fractionally. Spearman uses midranks and excludes a typist if either rank vector is constant.
- Nominal 80% coverage is the participant-macro share of later cell means within `mu+d_hat ± 1.2815515655 * sqrt(V+sigma²[p]/m)`, where `m` is the later clean count. This conditional predictive range treats the estimated speed as fixed. L5 supplies the ranges and decisions.
- Report overall and by source WPM bands below 40, [40,80), [80,100), [100,120) and 120+. Include assignment, scoring and metric-specific denominators. The overall group retains missing WPM if present. A missing estimate is unavailable.
- Use 2,000 same-size bootstrap draws with replacement over qualifying typists, NumPy `default_rng(20261124)`, 2.5th/97.5th percentiles with linear interpolation. Conditional metrics resample their own denominators. Paired contrasts resample within-typist differences. One typist gives a point only. For a constant empirical sample the bootstrap endpoints coincide. Subgroup and secondary intervals are descriptive.
- **D10 speed stress test.** Refit anchors, center, slopes and support using only training typists with source WPM below 100. Retain full-fit variance components to isolate the speed fit. Report full and restricted L2/L5 MAE and paired restricted-minus-full cost on the same held-out 100+ typists, also splitting [100,120) and 120+. The lower cut preserves a practicable high-speed cohort.
- **D2 validation-only secondary.** Update L5's personal speed and gap from clean plus B3's corrected-sentence intervals in the earlier half. Keep population parameters, clean later targets, labels and the original clean scoring mask identical. Compare paired MAE, yield and adjudicable hit rate. A lower 95% bound above 0.020 for clean-minus-augmented MAE would warrant considering a separate eligibility change. Fresh scoring uses clean-copy histories.

## Identity and execution

The scoring code is `f9fe277e179d8acc97e0e44742156b8d5579ae8e`. Evaluation decisions were recorded in `89335e4` before validation. B3's data builder is `c5dcd6258251fb05fdf85b570a7b678335b89e4d`. Run `ml.coach.validation.fit_training` on the pinned train file, `coach_inputs()` on the pinned corpus and Ridge, and `score_split(model, limited, ridge, frequency, fresh_clean_npz)` once under B6. B6 records the fresh derived-file SHA256 before scoring. Hashes below are SHA256. Version-controlled text uses Git LF bytes.

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
| A3 pair frequencies | `73053fe706308e95a04052ba8fe19dfaecb00079104f46af9cd2b6a31c9d1327` |
| Frozen Ridge | `7ffce48105ac2dc9c9915d01f9277a7f4b7cfeca6d0377ce8d44a8d70536a836` |
| Fitted full model | `c813005bd99f23fc88b9370490eb8dffa1792c57d5151d23b07047477fe85158` |

The fitted-model digest uses concatenated little-endian float64 values beginning with center, low and high, followed by the arrays of L0 pair means, anchors, slopes, gap variances and residual variances. Array order is `aa` through `zz`. B6 verifies the digest and input hashes before scoring. The full center is 4.991806588457015 and the support is [4.3868277835121745, 5.9303363670890565] log ms. The below-100 fit has center 5.00703192871013 and support [4.431611285801627, 5.933951603104741].
