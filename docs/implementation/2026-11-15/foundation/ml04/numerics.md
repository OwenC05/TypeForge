# Floating-point abstention bound

This is a forward-error envelope for arithmetic on the engine's computed log observations, not a practical/scientific minimum effect, uncertainty model, or accuracy guarantee for the transcendental `Math.log` implementation. Identical input intervals produce identical computed logs; the regression concerns accumulating those same logs in different orders. No model/config/schema/baseline version or packaging changes.

Supported engine domain: a clean within-word interval is positive, finite and at most 5000 ms (`engine.ts`). The least positive binary64 interval is `Number.MIN_VALUE`. Thus the magnitude of a computed log is bounded by `L = max(abs(log(Number.MIN_VALUE)), log(5000))`, approximately 744.4400719213812. This includes fractional/submillisecond intervals and negative logs; no unsupported 1-ms lower limit is assumed. A prompt has at most 300 characters, hence at most 299 pair observations; ten retained sentences contain at most 2990. Counts, including supported smoothing k=1/5/20, are small exact integers.

Binary64 unit roundoff is `u = Number.EPSILON/2`. For n rounded operations, `gamma(n) = n*u/(1-n*u)`. The usual absolute summation bound uses the sum of absolute operands, so it also covers mixed-sign logs/cancellation; it does not assume nonnegative log sums. With at most n observations of magnitude L, division by the exact count bounds each mean's absolute accumulation error by gamma times L.

Conservative operation budget N=3308:

- 300 steps cover the engine's at-most-299 additions per sentence/pair (including one spare).
- 10 steps cover combining the same pair over ten sentences.
- 2990 steps cover total-history accumulation: no more pair-stat entries than observations across the ten sentences. This deliberately uses the worst-case entry bound rather than corpus-specific pair counts.
- 8 steps cover total-mean division, smoothing multiply/add/division and final subtraction, with spare steps. Smoothed pair and user means are convex combinations with positive k; their scale cannot grow beyond the input magnitude through exact smoothing. The population baseline is an input binary64 value; user/no-artifact paths return the same user mean.

Both sides' forward errors plus final subtraction are covered conservatively by `T = 2*gamma(N)*max(L, abs(computedBaseline), abs(computedUser))`. The larger computed scale also handles finite population artifacts outside the engine's log range without changing their validation. At normal supported scales T is approximately 5.468087666919605e-10 log-ms. The gate is `difference > T` **before** multiplying by bank occurrences; repeated opportunities cannot amplify arithmetic residue into eligibility. Exactly T abstains. Existing positive scores above T retain their exact formula and ordering.

This envelope covers histories constructed from supported engine observations and their binary64 summaries, including persisted/reloaded exact JSON number round trips. It does not certify arbitrarily fabricated summaries merely accepted by permissive lower log-sum storage bounds, or recover quantization/clock/measurement uncertainty. The profile boundary and storage validation remain unchanged. Stage 2A owns any future meaningful-effect, support/stability, freshness or uncertainty policy.

Boundary tests independently compute T and check 0, T/2, T, 2T with one versus 100 occurrences/passage. A 1e-8 pair log contrast remains selectable with k=1/5/20; this is deliberately far smaller than a plausible coaching effect and demonstrates that no scientific effect threshold was introduced. Existing exact-score/tie, support, missing-artifact and model-invalidity tests remain in place. Uniform tests include least-positive, fractional, 1, 200 and 5000 ms logs; accumulated and count-multiplied summaries; reversed and seeded orders; maximum supported counts; and the actual engine's ten-sentence 200-ms reproduction.
