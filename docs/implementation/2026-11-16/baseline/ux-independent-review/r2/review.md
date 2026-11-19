# Independent actual-Claude delta review: UX r2

18 November 2026 · Task `task_b2b8be79c156`, Dispatch `ctx_7da4854c30a4` (same reviewer terminal as `05a6767`). Brief: root `3807dca` `task-claude-ux-r2-review.md`, plus root messages `msg_0f1950221448` and `msg_95a8052c7f31`. Subject: the author revision `3ad71b6` (root `ecf8d18`) composed with the root stylesheet (blob `1b10cbea…`) and Vite 8.3.3. The original REVISE review (`../review.md`, `05a6767`) is unchanged.

## Verdict: **REVISE**, narrowly

Seven of the eight original findings are fixed in the composed prototype. The eighth, the P0 honesty finding, is fixed for its original cause (`coaching-deferred` and the disabled config). However, r2 introduced a new defect on the same honesty surface. A person whose Suggested **has** a focus opens why? and reads **"Suggested is unavailable right now."** This happens on `/` with General and while practising Suggested · th. The author's own committed capture shows it (`ux/evidence/screenshots/1440-14-practice-suggested-why.png`). The finite end has one visible conflict with the frozen P1 r2 precedence. Two contract deltas root has already accepted are pending from the author (`64a53b4`). Everything else is ready to approve.

When the author's delta commit lands with N1 and N2 below fixed, re-running `evidence/scripts/delta.mjs` plus the affected captures is sufficient. The review does not need to restart. This is a fixture verdict on visible behaviour. It is **not** production, engine, storage, P1-adapter or finite-producer acceptance.

## Source correspondence (the gap root found)

I built the frozen prototype against the root stylesheet and toolchain with a review-owned runner (`runner/vite.r2.config.mjs`). I also replayed the author's own composition (Vite 8.3.1, style `41426a7`) separately in scratch. The replay reproduced the author's recorded `index-BADpSMsf.js` (`5f84f6c8…bfff`). After normalising chunk filenames, the JS and HTML are byte-identical across the two builds. The composed production-style chunk, minus its single forced-colours block (991 bytes), is byte-identical to the author's. So the **only** built difference is the accepted forced-colours block, which I established by byte comparison, not from screenshots (`evidence/build-compare.json`, `evidence/source-sha256.txt`). Normal-colour behaviour therefore carries over, and I re-captured forced colours on the composed build.

## Finding-to-fix disposition (slice 1)

| # | Original finding | r2 disposition | Independent evidence (composed build) | Remaining |
|---|---|---|---|---|
| 1 | P0: `coaching-deferred` rendered a false promise, `undefined` and a re-check | **Fixed for the original cause; new regression N1** | 48/48 reason × config cases honest. Coverage: 16 reasons including unknown and null × {enabled+scanned, enabled+scan-false, disabled+null} × press / why? / screen-reader text / Progress. No `undefined`. No gate sentence or re-check promise unless a gate ran. Nothing advertises an unlock when coaching is disabled. Final `deferred` makes no analysis claim. | **N1 (P1, blocking)** |
| 2 | P1: summary frozen, buried, no home | **Fixed** | Progress states 10/10: figures, WPM-only, updating, selection-unproved and pending give "still being read" with no number, and below-ten / unavailable / not-complete / checking with a summary object present show nothing. Reset removes the median. On the final result, *Baseline complete.* → **Last 10 tests · median** → focus or one reason, with figures at 32 px against the 96 px hero. | P3 note: at 320 the focus scroll puts *Baseline complete.* and the summary label above the fold (figures cut at the top, `320-11`). Progress is the home, so this is not blocking. |
| 3 | P1: QWERTY could silently spend test 1 | **Fixed** | One Tab from the focused text reaches **my keyboard is qwerty**. It is in view at 320 before the first key. Enter switches qwerty on, the label becomes *Baseline test 1 of 10*, and focus returns to the text (3 widths). The not-counted result offers the same key and then **take test 1** focused. First visit is unchanged. | — |
| 4 | P1: lower bound printed as an ordinal | **Fixed** | At least 7 → *Baseline test · 30 s* → result → next → Progress (*at least 7 of 10*, *take a baseline test →*). No ordinal anywhere. | Technical: P1 r2 supplies `participation.ordinal`, and the UI must use it rather than recomputing (see Technical boundaries). |
| 5 | P2: early Enter dropped the test; the late save threw | **Fixed (fixture)** | 8/8: Enter at 0 ms, during and after the save gives test 6 with count 5 once saved. Failure → next → retry from the slot (focus back in text). Late failure during an active run leaves label, slot and focus frozen, and test 5 is offered for retry after the run. Late success during a run is also frozen. Interrupted → *try test 5 again*. Final-test failure → Enter retries → completion. 0 page errors. | Reload and lost-pending case not executable in a fixture. |
| 6 | P2: save failure below the fold at 320; dead details key | **Fixed, judged below** | Retry is the focused primary in all 51 result captures with a primary, and in view in all 51. There is no `href="#"` key. | Optional a11y improvement (below). |
| 7 | P3: tally read as an underline | **Fixed** | No `.tally` in 162 captures. Forced-colours pixel profile (`evidence/forced-shape.json`) at all three widths: filled `######`, empty `..##..` (centre line), pending `##..##` (outlined). State is carried by shape and text, not colour. | — |
| 8 | P3: Progress repeated itself; "five minutes in all" | **Fixed** | One count, one provenance line, **take test 5 →**, no other-context sentence. why? says *about five minutes of typing*. | — |

## New and remaining findings (ranked)

**N1 — P1, blocking. why? says Suggested is unavailable when Suggested has a focus.** `whyBaseline()` calls the unknown-reason fallback (`shownReason(...) === 'unknown'`) before it checks `complete-ready`. P1 gives `complete-ready` no reason in r1, and the reason `'supported'` in r2 (`policy/interfaces-r2.ts`). Neither is in `copy.ts` `reasons`, so the focus explanation and its rule-of-thumb limit (contract A12) are never shown. Instead the panel contradicts the rail and the label. Reproduced in 8 checks: reason null, absent and `supported` × General and Suggested, plus the author fixtures `s10ready` and `s10changed`, at all 3 widths (`RV-01`). The same flat-reason design shows two smaller symptoms under P1 r2's new `automaticCoaching: 'unavailable'`. The press says *isn't switched on in this version* (a config fact the UI cannot know), and at ten the panel appends the *re-checks after each saved run* promise after `policy-invalid`, a non-gate reason.
*Remedy:* present `complete-ready` with a focus before any reason fallback. Add `supported` as a non-presenting reason. Show `generalFits` only after the seven gate reasons. Map `automaticCoaching: 'unavailable'` to the unavailable sentence, not to `coaching-deferred`. *Regression:* why? and press for `complete-ready` with reason null, absent and `supported` in both kinds, and `automaticCoaching: 'unavailable'` at 4 and 10.

**N2 — P2. A flagged run that reaches the plan end is shown as a clean early finish.** If focus leaves the text and the person then completes the plan, the result is the ordinary plan-end result with no flag line. That conflicts with `finite-plan-end.md` rule 10 and the frozen P1 r2 precedence (root `msg_95a8052c7f31`, `finite-adapter-r2.md`): the flags are kept and the interruption explanation takes precedence over the end observation. *Remedy:* for plan-exhausted with flags, keep the early-end label, show the existing flag sentence in place of (or before) the observation, and never present it as clean. *Regression:* blur, then finish the plan, then expect the flag line.

**Pending, accepted by root, assigned to the author (`64a53b4`) and not yet delivered:**
- **D1 prior pair.** The *Suggested now leans on er. th no longer stands out…* and *stepped back… th* slot lines (states 18/19) may name the previous pair only from an in-memory admitted snapshot. After a reload, or with no prior snapshot, show the current fallback without inventing the earlier pair.
- **D2 exact 30 s pilot.** State 37 uses `dur=60` and shows *all 3 sentences done at 24 s of 60*. In the prototype, Suggested · th still runs at 60 s (`Suggested practice · th · 60 s`). The visible example must be 30 s, with truthful duration-mismatch handling that keeps General/manual and the duration keys usable.

## Finite visible end (slice 4)

Checked at 30 s with the accelerated clock, a labelled fixture stand-in:
- **No wrap:** the last sentence's context line reads *— end of this block —*.
- **Immediate end:** the block ends at the final submission with time still left.
- **Label:** *Suggested practice · th · all 3 sentences done at 16 s of 30*, never *30 s · complete*.
- **No figures**, and the repeated-small-set line is shown. There is no baseline, dose or coach-eligibility copy.
- **Actions:** **suggested again ↵** is focused, with **general** secondary, and Enter lands on Suggested · th ready with the text focused.
- **Timer first:** if the timer ends before the plan, the result is the ordinary result.
- **Layout:** at 320 the whole result fits with no scroll (`320-37`).

Figures stay unavailable until the producer/validator is accepted. Source exclusions (all practice from the baseline and summary; early plan-exhausted from coach sources) are not claimed or contradicted by any visible copy. Their enforcement belongs to the technical reviewers. Open items: N2, D2.

## The 320×640 failed-save judgment (slice 3)

My original criterion said retry should be *visible at 320×640 without scrolling*. On the composed build, the browser's focus scroll moves the page 413 px. The layout itself does not fit. The person does not scroll, but the result label and their figures sit above the viewport (label top −207 px).

I accept this as meeting the **intent** of the criterion, though not its wording. The intent was that the person cannot miss that the test didn't count and has the safe action ready. In view are the failure lead *Not saved yet, so it doesn't count.* (top 171 px), the count with its pending segment, *Retrying is safe…*, the focused **retry saving ↵** and **next test**. Enter does the safe thing. The scroll is the same accepted mechanism every focused-primary result uses at 320: the saved result scrolls 367 px, not-counted 331 px and the final 641 px. Making the failure case the one result that doesn't scroll would change the accepted result layout. The figures are one scroll away and are not the decision at that moment.

I do not equate this with a no-scroll layout. My criterion 7 is amended to: *retry saving is the focused primary and, together with the failure sentence, in view at 320×640, without the person scrolling.*

Optional a11y improvement: give `#primary` `aria-describedby` pointing to the lead line. Focus then announces the consequence as well as the button name, rather than relying on the save-row `role=status` alone.

## Visual and accessibility acceptance (slice 3)

There are 162 fresh-context captures on the composed build: the author's 38 states and 3 review states at 1440×900, 390×844 and 320×640, plus 13 states × 3 widths in Chromium forced-colours emulation.
- **Integrity:** 0 page errors, 0 horizontal overflow, 0 clipped slots, 0 `undefined`/`NaN`.
- **First visit:** focused text and General 30 s, with the active line at 36.9 / 37.5 / 48.4 %. The locked Suggested key is `aria-disabled` and keyboard-reachable, described as *Not yet available: 0 of 10 baseline tests.*, and there is no tally.
- **Forced colours:** the locked key keeps its dashed shape next to the root's Highlight-checked General key, and progress differs by shape.

I inspected by eye 320 save-failed (09/36), 320 final-ready, 320 undeclared qwerty, 320 plan end, 390 Progress summary, 390 forced-colours final deferred, 1440 forced-colours locked press and 1440 Suggested why? (N1).

## Technical boundaries (separate from the UI judgment)

None of these is a UI failure. Each has to be reconciled when the UI is ported to P1 r2 (`policy/interfaces-r2.ts`, `lifecycle-r2.md`, `finite-adapter-r2.md`):
- The flat `BaselineStatus` must be projected from the separate `participation`, `summary` and `coach` components. Do not infer one from another's flag.
- Use P1's `participation.ordinal`. P1's `pendingSave` counts only compatible, original-captured, unsaved assessments.
- `automaticCoaching` has three values.
- The plan-exhausted envelope, figures validity and finite persistence/recovery are separate.
- The prototype's `practise` link from a failed final test drops the unsaved test. Production must route it through the existing ET-1 leaving guard (`unsaved.ts`).

## Implementation acceptance tests still required

These run on the real build with injected P1 r2 statuses and save outcomes:
1. Port `delta.mjs` (this review) and the author's `regressions.mjs`, including the N1/N2 regressions.
2. Reason presentation over every P1 r2 reason including `supported`, and over every `automaticCoaching` value.
3. Ordinal and pending taken from P1 fields, including reload with a lost pending save.
4. Leaving with an unsaved baseline test goes through ET-1.
5. Finite engine cases per `finite-adapter-r2.md`, including flagged → end.
6. The 162-capture matrix and the forced-colours shape probe.
7. Windows High Contrast themes, a screen reader pass (NVDA/JAWS/VoiceOver), Firefox/Safari, a physical phone and IME.
8. The short human comprehension check from my original criterion 10 ("what does 7 of 10 mean? what happens at 10?"), which is still open. There were no participants and none are implied.

## Executed, receipts and limits

- **Runner:** `runner/vite.r2.config.mjs`, using a read-only root `node_modules` (lockfile blob `151cf9b3…` = `ecf8d18`). Nothing was installed.
- **Preview:** hidden helper on `127.0.0.1:5318 --strictPort`, PID 5532. Its command line was `node …/typeforge-daily-practice/typing-app/client/node_modules/vite/bin/vite.js preview --config …/r2/runner/vite.r2.config.mjs`, and it was the verified listener before I stopped it. 5318 was free afterwards. Root's 5301 (PID 28552) was not touched.
- **Browser:** headless system Chrome via `playwright-core` 1.65.1 in the session scratchpad, with a fresh context per check.
- **Scripts:** `evidence/scripts/delta.mjs` gave 90 checks: 78 pass, 9 fail (N1 ×8, N2 ×1), and 3 pending/informational (D2 and `automaticCoaching: 'unavailable'` ×2). The first run's failures from my own text-case bug were corrected and re-run, and are not counted. `capture.mjs` gave 162 captures. `forced-shape.mjs` gave 18 profiles. The author's regressions were not used as evidence here.
- **Receipt (`evidence/receipt.json`):** this dispatch reused the reviewer terminal. Orca records no requested model or effort for it; effective agent `claude`, provider projection `claude` / `claude-opus-5-5`. The terminal's origin launch (`ctx_f5e22117b85e`) recorded requested and effective `claude` / `claude-opus-5-5` / `high`. The session reports model `claude-opus-5-5`; effort is not visible from inside. No helpers or subagents were used.
- **Limits:** these are simulated fixtures with simulated saves and a 10× clock where labelled. One engine and emulated viewports and forced colours only. No production engine, storage, P1 projection or finite producer was involved. No human was involved.
