# Does practising a slow letter pair help on fresh text?

**Draft, 24 November 2026. Not frozen.** Owen runs the self-trial first and decides whether to invite volunteers. Before each study, archive a dated protocol, model, metric and bank versions. Settle consent, withdrawal and any university ethics review before recruitment.

## Who and what gets assigned

Does a personally slow letter pair get faster on unseen passages after targeted practice? Adults of any typing speed can screen if they can copy English on a desktop or laptop with a physical QWERTY keyboard. Use the same device, keyboard and browser profile throughout.

On screening text, the phase B model identifies pairs confidently slower than expected at this person's speed and returns their estimated gaps in log milliseconds. Freeze its eventual confidence and speed-support rules before screening. The assessment forms must cover each candidate, and either member must be trainable. Use separate text for the outcome baseline.

- **Volunteers.** Choose the two qualifying letter pairs closest in gap size. Cap recruitment at 20 randomised volunteers, one matched set each. With 20 completers and twice the observed noise variance, estimated power is 18% for a 5% shortening and 55% for a 10% shortening. This sample addresses feasibility. Analyse Owen separately. [Power estimates](power.md)
- **Owen alone.** Use eight disjoint sets if at least 16 pairs qualify, or six if 12–15 qualify. With fewer, rehearse with up to four sets. Minimise the sum of absolute within-set gap differences. In both designs break ties alphabetically and lock the sets before the outcome baseline.
- **Allocation.** Save a uniformly generated participant seed at entry. Use separate random draws for form order and one fair flip per matched set. For example, if `st` and `dr` match, one gets targeted practice and the other is held back. Record the allocation, algorithm version and time after baseline and before the first drill.

We predict greater shortening for the practised pair. Shared gains cancel in the comparison. Random allocation balances regression to the mean in expectation. Transfer to similar pairs or incidental exposure to controls could reduce the difference.

## Participant protocol

| When | Volunteers | Owen |
|---|---|---|
| Day 1 | Opt in. Screen for up to 10 minutes. Stop if no set qualifies. | Same. Lock the sets and take one extra fresh, untreated measurement to estimate day-to-day noise. |
| Day 2 | Take the fresh baseline, then receive the assignment. | Measure all sets together. |
| Practice | Days 3–7, two 30-second blocks per day on the assigned pair. | Days 3–7 and 10–14, one 30-second block per practised pair per day in rotating order. |
| Follow-up | Day 9, even after missed practice. | Day 16, all sets together. |

Ten blocks give each target five minutes of practice over at least five days. This limits the time commitment while allowing repeated exposure. Continue everyday typing, record extra drills and stop if uncomfortable. Take follow-up 24–72 hours after the last **scheduled** drill.

Preassign fresh v2 assessment forms and interleave both arms' opportunities. Stop each assessment when every pair has 20 clean observations or after 15 active minutes. Use the first 20 per pair. Allocate practice only after a complete day-2 baseline. Record coverage failures. For Owen, day 1 to day 2 measures untreated variation. Day 2 to day 16 is the primary comparison.

## Outcomes and analysis

At each visit take the mean natural log of the v2-eligible keydown-to-keydown intervals in milliseconds for each within-word lowercase pair. For each set calculate

```text
D = (post − pre for the practised pair) − (post − pre for the held-back pair).
```

Negative D favours practice. Report mean D and relative shortening of the geometric-mean interval, `100 × (1 − exp(mean D))`. Use two-sided tests at 5% because practice could also slow typing.

- **Volunteers.** Test mean D against zero with a one-sample t-test. Bootstrap whole participants 10,000 times with replacement (seed 20261124) for a percentile 95% interval. Check the visit-by-assignment interaction in a mixed model of interval-level log time, with both main effects, participant intercept and visit slope, and intercepts for pair within participant and passage. Report any fit failure.
- **Owen.** Under the sharp null, allocation changes none of his pair outcomes. Enumerate all within-set label flips. The exact p-value is the fraction with absolute mean D at least as large as observed. Report each D and their unweighted mean. Six sets give 64 assignments. Four sets allow a minimum two-sided p-value of 0.125. Inference concerns Owen and these pairs.
- **Secondary.** Apply the same change contrast to first-attempt pair accuracy in percentage points. Count all occurrences with both positions attempted, including errors. Both first entries must be correct for success. Report overall assessment WPM change descriptively, pooling positional character matches divided by five and by active minutes at each visit.

Keep original assignments, including missed drills. The primary volunteer analysis requires all four in-window cells with 20 observations and matching versions. As a sensitivity check, include compatible visits outside the window and cells with 1–19 observations when all four cells exist. Use observed timings only. Show an incomplete self-trial descriptively. Missingness related to typing difficulty could bias estimates.

Keep the recruitment cap and follow-up fixed. Date deviations, give reasons and label post-outcome changes exploratory. For benefit, harm, inconclusive results or infeasibility, publish aggregate screening yield, exposure, adherence, missingness and reasons, timing, accuracy, WPM, uncertainty and deviations. Obtain Owen's agreement before sharing personal results.

## Later app requirements

1. **Assignment.** The saved snapshot, seed and versions reproduce sets, allocation and form order. Reload resumes the same assignment.
2. **Scheduling.** Only assigned pairs receive targeted drills. Count incidental exposures in both arms and completed, missed and extra blocks. Resuming counts a block once.
3. **Fresh text.** Reject passage hashes seen in screening, drills, earlier app history or another visit. Replay verifies v2 eligibility, order and the count or time that ended assessment.
4. **Progress.** Show days, blocks and pair coverage. Follow-up remains accessible after missed practice. Reveal arm comparisons after follow-up closes.
5. **Export.** Check that a voluntary, versioned pseudonymous JSON download reproduces every outcome. Include allocation, versions, relative times, passage IDs, exposures, ordered eligible intervals, accuracy counts, WPM inputs and deviations. Data stay in the browser until the participant chooses to share.
6. **Deletion.** Verify that confirming deletion and reloading clears pilot records and exportable data. Provide a withdrawal contact for previously shared files.
