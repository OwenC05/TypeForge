# Acceptance criteria and UI implementation handoff

For the single later owner of `app.ts`/`style.css` (actual Claude per the plan), after root freezes the policy interface. Prototype: `prototype/` (copy deck `copy.ts`, delta CSS `baseline.css`, behaviour `proto.ts`).

## Acceptance criteria (each needs exact-source browser evidence at 1440×900, 390×844 and 320×640)

**Arrival and readiness**
- A1. A clean first visit to `/` gives the textarea focus, General 30 s, and a first key that starts the run. It is pixel-identical to the accepted first visit (no tally at 0). Measured in the prototype: active line top 36.9 % at 1440, 37.5 % at 390, 48.4 % at 320 (the inherited 320 two-row rail at 640 px height).
- A2. No baseline element takes focus on load, intercepts keys or delays General while status is `checking`.

**Locked Suggested**
- A3. The locked key is reachable by Tab/arrows and by pointer. Activation is cancelled (`valuechange.preventDefault()`), the slot explains in ≤ 75 characters with one action key, and General (or the current kind) stays checked. It has `aria-disabled="true"` and `aria-describedby` pointing to an sr-only status sentence.
- A4. The tally is shown only from 1 to 9, is `aria-hidden`, and costs no layout. It is absent for `checking`, `unavailable`, 0 and 10.

**Counting**
- A5. The label reads `Baseline test n of 10 · 30 s` only when 30 s, qwerty and counting all hold. Otherwise it reads `Assessment · d s`, with a one-line slot reason and no locked control.
- A6. Counts change only after a durable save. A pending segment shows in graphite. A failed save shows "Counts once it’s saved.", and the accepted retry/export applies.
- A7. A flagged, aborted or empty run is "Not counted … nothing is taken away", with `try test n again ↵` focused.
- A8. Boundaries 0, 1, 9, 10 and 11 show 0, 1, 9, 10 and 10. With an incomplete proof the UI shows "at least n" and never a bare number. Deletion re-derives the count, and reset gives 0 with results kept.

**Completion**
- A9. Test 10 saved with `complete-ready` → **try suggested · pair ↵**. Enter lands on `/` with Suggested checked, the label `Suggested practice · pair · 30 s`, and focus in the textarea.
- A10. Test 10 saved with any `complete-insufficient` reason → **practise general ↵**, one reason sentence plus the General/pair alternative. No "fail", "level" or "weak".
- A11. Focus change or step-back is announced once in the slot at the next ready state and never mid-block.

**Explanation**
- A12. `why?` states the count, what counts, what doesn't, the ~5-minute burden, and that the count comes from saved tests (so deletion and reset are self-explanatory). In Suggested mode it gives the ms comparison, observations, words, runs and the rule-of-thumb limit.
- A13. Each P1 reason code maps to exactly its `copy.ts` sentence. `unavailable` shows no number.

**Robustness**
- A14. No horizontal overflow and no clipped slot in any state at 320. 0 page errors.
- A15. Forced colours: the tally and progress use CanvasText/GrayText (`baseline.css`), plus the accepted F-1/F-2/F-2b rules. Verified in the Chromium emulation; Windows HC themes remain a separate gate.
- A16. Unchanged: 132 tests, typecheck, build, the geometry matrix, typing-flow, unsaved and agent suites. The native textarea stays outside SDK agent writes.

## Concrete handoff

1. **Data.** Implement `BaselineStatus` (contract §3) behind one bounded async read, started after first paint (as today's `calibration()` is). Late results refresh only the rail, `why?` and the assessment label before the first key, never an active run.
2. **Rail.** In `app.ts:207`, replace `disabled` with `data-locked aria-disabled="true" aria-describedby="suggested-status"` and append the tally `<span class="tally">`. Add an sr-only `#suggested-status`. In the existing `#practice-kind` `valuechange` handler, call `event.preventDefault()` and show the press message when locked, then delete the `pointerdown` workaround at `:737`.
3. **why?** Replace `#focus-state` and `#recommendation-reason` with the baseline block from `proto.ts:whyBaseline()`. Keep `#exercise-intro`, `#prediction-state` and the timer sentence.
4. **Assessment page.** In the `blockIdentity` text, use the baseline label rule. The ready slot hint is level 1 (yields to integrity notices).
5. **Result.** In `resultPanel()` for assessments, insert `#baseline-result` after the observation, and swap actions per contract §5. Count only on the save-state transition to saved, and reuse the existing save/retry state machine.
6. **Progress page.** Add the Baseline section with an inline confirm (`#keep` focused). Reset calls the P1/P3 epoch API and then re-reads.
7. **CSS.** Append `baseline.css` (minus `.fixture-label` and `.figures-fixture`) to `style.css`. It adds no new tokens.
8. **Copy.** Move `copy.ts` strings verbatim. Any change goes back through actual Claude.
9. **Tests.** Port `evidence/scripts/keyboard.mjs` (45 checks) and `capture.mjs` (27 states × 3 widths) against the real build with fixture-injected statuses. Add unit tests for the label/ordinal/press-copy mapping.

## Honest limits of this evidence

- The prototype is a static simulation: fixture statuses, fixture figures and a 10× accelerated clock where `fast=1` is set (labelled). It does not use the production engine, storage or policy.
- Headless system Chrome 157 via playwright-core 1.65.1 only. No Firefox/Safari, physical device, IME, screen reader or human use. Comprehension of the copy is not user-tested.
- The fixture label sits in the gap under the top bar and grazes the qwerty key's top edge at 320. It is prototype chrome, not part of the design.
