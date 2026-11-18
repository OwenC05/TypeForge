# Acceptance criteria and UI implementation handoff

For the single later owner of `app.ts`/`style.css` (actual Claude per the plan), after root freezes the policy interface. **r2 (18 November 2026):** updated after the independent critique `05a6767`. See [revision-r2.md](revision-r2.md) and [finite-plan-end.md](finite-plan-end.md). Nothing here is final acceptance. Prototype: `prototype/` (copy deck `copy.ts`, delta CSS `baseline.css`, behaviour `proto.ts`).

## Acceptance criteria (each needs exact-source browser evidence at 1440×900, 390×844 and 320×640)

**Arrival and readiness**
- A1. A clean first visit to `/` gives the textarea focus, General 30 s, and a first key that starts the run. It is pixel-identical to the accepted first visit: qwerty off and no declaration prompt. Measured in the prototype: active line top 36.9 % at 1440, 37.5 % at 390, 48.4 % at 320 (the inherited 320 two-row rail at 640 px height).
- A2. No baseline element takes focus on load, intercepts keys or delays General while status is `checking`.

**Locked Suggested**
- A3. The locked key is reachable by Tab/arrows and by pointer. Activation is cancelled (`valuechange.preventDefault()`), the slot explains in ≤ 75 characters with one action key, and General (or the current kind) stays checked. It has `aria-disabled="true"` and `aria-describedby` pointing to an sr-only status sentence.
- A4. (r2) There is no tally. The locked key's `aria-describedby` sentence carries the count. The visible count lives in why?, results and Progress.

**Counting**
- A5. The label reads `Baseline test n of 10 · 30 s` only when 30 s, qwerty and counting all hold **and** `baselineProofComplete` is true. With a lower bound it reads `Baseline test · 30 s`, with the hint *At least n of 10 found; this one counts too.* Otherwise it reads `Assessment · d s`, with a one-line slot reason and no locked control. With qwerty off, the hint offers **[my keyboard is qwerty]**: an explicit press of the existing switch, after which focus returns to the textarea.
- A6. Counts change only after a durable save. A pending segment shows in graphite, outlined under forced colours. A failed save shows *Not saved yet, so it doesn’t count.* with **retry saving ↵** as the focused primary, in view at 320×640, and next test as secondary. There is no dead details key. A failed save stays pending and recoverable after the person continues.
- A7. A flagged, aborted or empty run is "Not counted … nothing is taken away", with `try test n again ↵` focused.
- A8. Boundaries 0, 1, 9, 10 and 11 show 0, 1, 9, 10 and 10. With an incomplete proof the UI shows "at least n" and never a bare number. Deletion re-derives the count, and reset gives 0 with results kept. An exact ordinal never comes from a lower bound, appears at the cap, or appears while checking or unavailable.

**Completion**
- A9. Test 10 saved with `complete-ready` → **try suggested · pair ↵**. Enter lands on `/` with Suggested checked, the label `Suggested practice · pair · 30 s`, and focus in the textarea.
- A10. Test 10 saved with any `complete-insufficient` reason → **practise general ↵**, one reason sentence plus the General/pair alternative. No "fail", "level" or "weak". The re-check sentence appears only after a gate that ran.
- A11. Focus change or step-back is announced once in the slot at the next ready state and never mid-block, **only from the previous in-memory admitted snapshot** (delta r2.1). After a reload or navigation, or with no prior snapshot, the copy names no previous pair and gives the current fallback. Legacy `practiceFocus` is never read.

**Explanation**
- A12. `why?` states the count, what counts, what doesn't, the ~5-minute burden, and that the count comes from saved tests (so deletion and reset are self-explanatory). In Suggested mode it gives the ms comparison, observations, words, runs and the rule-of-thumb limit.
- A13. Each P1 r1 reason code, including `coaching-deferred` and `source-integrity`, maps to exactly its `copy.ts` sentence. An unknown reason maps to the defensive sentence. A gate reason shows only when coaching is enabled and the scan completed. `unavailable` shows no number. No rendered text contains `undefined`.

**Robustness**
- A14. No horizontal overflow and no clipped slot in any state at 320. 0 page errors.
- A15. Forced colours: progress filled versus empty differs by shape (a full segment versus a thin centre line), and pending is an outlined segment (`baseline.css`). The accepted F-1/F-2/F-2b rules also apply. Verified in Chromium emulation; Windows HC themes remain a separate gate.
- A16. Unchanged: 132 tests, typecheck, build, the geometry matrix, typing-flow, unsaved and agent suites. The native textarea stays outside SDK agent writes.

**r2 additions**
- A17. Honest promise: Suggested is named as the outcome only when `automaticCoaching === 'enabled'`. Under a disabled config, nothing advertises an unlock, the copy uses `coaching-deferred`, and no gate reason or re-check sentence appears.
- A18. **Last 10 tests · median** sits on the final result, directly under *Baseline complete.*, with figures one step below the hero, and persistently on Progress with the date range and update note. The states are figures, WPM-only (null accuracy), updating (eleventh save pending), still being read (summary pending or selection proof incomplete) and none (below ten, deletion, reset, unavailable). There is never a cached median. Milestone proof and summary-selection proof are separate inputs.
- A19. Save timing: Enter on *next test* at 0 ms, during the save, or after it gives n+1. A late success updates only the count surfaces. A late failure during an active run changes nothing visible in that run and is offered after it. Retry from the ready slot returns focus to the text. An interrupted test followed by *try again* raises no error. These are the named regressions REG-5a–g.
- A20. Progress shows one count, one provenance line, no other-context sentence, and **take test n →** (or *take a baseline test →*). why? says *about five minutes of typing*.
- A21. Finite Suggested plan: as specified in `finite-plan-end.md` (REG-9, D2d–D2f), 30 s only. A flagged run that reaches the end leads with the flag explanation.
- A23. Pilot context mismatch (delta r2.1): Suggested at a duration other than 30 s, or with qwerty off, gives a General block with an honest label, a slot hint and the person's own [use 30 s] / [my keyboard is qwerty] key. Duration is never clamped, nothing is blocked, and no focus evidence is shown for that block.
- A24. `automaticCoaching: 'unavailable'` (P1 r2 projection) reads as unavailable, never as switched off.
- A22. Port `evidence/scripts/regressions.mjs` (85 checks) against the real build with injected statuses and save outcomes.

## Concrete handoff

1. **Data.** Implement `BaselineStatus` (contract §3) behind one bounded async read, started after first paint (as today's `calibration()` is). Late results refresh only the rail, `why?` and the assessment label before the first key, never an active run.
2. **Rail.** In `app.ts:207`, replace `disabled` with `data-locked aria-disabled="true" aria-describedby="suggested-status"` (r2: no tally). Add an sr-only `#suggested-status`. In the existing `#practice-kind` `valuechange` handler, call `event.preventDefault()` and show the press message when locked, then delete the `pointerdown` workaround at `:737`.
3. **why?** Replace `#focus-state` and `#recommendation-reason` with the baseline block from `proto.ts:whyBaseline()`. Keep `#exercise-intro`, `#prediction-state` and the timer sentence.
4. **Assessment page.** In the `blockIdentity` text, use the baseline label rule. The ready slot hint is level 1 (yields to integrity notices).
5. **Result.** In `resultPanel()` for assessments, insert `#baseline-result` after the observation, and swap actions per contract §5. Count only on the save-state transition to saved, and reuse the existing save/retry state machine. r2: keep completed-but-unsaved results in a save queue that survives *next test* and *try again*. Freeze the run's identity (baseline flag, ordinal, label) at the first key. Repaint on save settle only the surfaces listed in contract rule 3. The summary block uses `summaryView()`.
6. **Progress page.** Add the Baseline section with an inline confirm (`#keep` focused). Reset calls the P1/P3 epoch API and then re-reads.
7. **CSS.** Append `baseline.css` (minus `.fixture-label` and `.figures-fixture`) to `style.css`. It adds no new tokens.
8. **Copy.** Move `copy.ts` strings verbatim. Any change goes back through actual Claude.
9. **Tests.** Port `evidence/scripts/keyboard.mjs` (45 checks), `regressions.mjs` (85 checks, the named oracle for findings 1–8 and the finite end) and `capture.mjs` (38 states × 3 widths, plus 6 forced-colour states × 3) against the real build with fixture-injected statuses. Add unit tests for the label/ordinal/press/reason/summary mappings (`copy.ts`), including every reason and an unknown one.

## Honest limits of this evidence

- The prototype is a static simulation: fixture statuses, fixture figures and a 10× accelerated clock where `fast=1` is set (labelled). It does not use the production engine, storage or policy.
- Headless system Chrome 157 via playwright-core 1.65.1 only. No Firefox/Safari, physical device, IME, screen reader or human use. Comprehension of the copy is not user-tested.
- The fixture label sits in the gap under the top bar and grazes the qwerty key's top edge at 320. It is prototype chrome, not part of the design.
- Full-page captures at 320/390 show the production skip link stitched mid-page. That is a capture artifact of `position: fixed; top: -100px`, not visible in viewport captures.
- Saves, save failures and their delays are simulated. Contract rule 4's reload case (a lost pending result) is described, not executed.
