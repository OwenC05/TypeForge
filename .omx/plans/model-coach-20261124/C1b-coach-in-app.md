C1b The model-driven coach in the app

Read `.omx/plans/model-coach-20261124/common.md` and `plan.md` first, especially D12, D13 and phase C. You are worker C1b. Port **5346** for browser runs; the harness takes `BROWSER_ENGINE` and `BROWSER_PORT` (`typing-app/client/tests/browser/README.md`). Python, if you need it, runs in WSL as `common.md` describes. WSL is currently unreliable: a startup timeout (`Wsl/Service/0x8007274c`) never reaches Python, so wait 30 s and launch again, up to 10 times.

Owen's direction: keep TypeForge lean. Build only what this brief needs. Remove what the new coach makes dead. No options, abstractions, tooling or documents for their own sake.

## Why

The fresh test passed (`ml/coach/REPORT.md`, "Fresh test"). L5 predicts a typist's later pair timing better than their own average, and plan D12 lets it choose the coach's pairs. It replaces the current rule (`clean-pair-contrast-v1`), which needs 10 baseline tests, can name only four pairs and mostly flags pairs that are hard on any keyboard. The browser model already exists and matches Python: `typing-app/client/src/coach-model.ts` (C1a) with `src/generated/coach-model.json`. Nothing calls it yet. Your job is to make Suggested practice use it, add the fit check, and remove the old rule. Worker C1c is calibrating the fit check's threshold in parallel (rule 4).

## Product rules (decided; do not change them without asking)

1. **Evidence.**
   - **What counts.** Eligible, submitted sentences from saved assessments and from General practice. General practice means practice results with no `practiceFocus`, no `manualDrill` and no Suggested marker (rule 3).
   - **Drills are excluded.** This covers Pair mode, old and new Suggested blocks, and finite plans. A drill packs one pair into every sentence, and practising inside a drill would move that pair's estimate.
   - **QWERTY only.** Use only results saved with `settings.qwerty` true. The model learned only from QWERTY typists on full-size and laptop keyboards (`ml/dataset.py:101`).
   - **Genuine typing only.** Skip results whose quality flags mean the timings are not genuine typing; check `RUN_FLAGS` in `storage.ts` and list the ones you skip in your ask.
   - **Current format only.** Skip sentences whose `pairs` lack the current `{count, logSum}` shape.
   - **Window.** Use the most recent 200 such sentences, or all of them if fewer, so that improvement shows up.
   - Fold them with `foldCoachHistory`, and decide with `update` and `suggestion`.
2. **Decision.** Suggested has a pair exactly when `suggestion` returns one and the fit check (rule 4) has not stopped it.
   - There is no baseline count, test gate or staleness rule; L5 abstains by itself when the evidence is weak.
   - Without a pair, Suggested runs a General block and says why in one short line. That block is General practice and counts as evidence.
   - If QWERTY is not declared, Suggested says it needs a QWERTY keyboard, and the existing declaration control stays.
3. **The block.**
   - A Suggested block on a pair is exactly what choosing that pair in Pair mode gives (`selectPairPrompts`, the v2 dense sentences), at the selected duration.
   - Save it so that rule 1 can tell it apart from General practice and from Pair mode.
   - Change the result schema as little as possible, for example by adding a new `source` value on an existing field. Every record saved by earlier versions must still validate.
4. **Fit check (monitoring).**
   - **The check.** Walk the evidence sentences in chronological order. For each sentence after the first, compute the state from the up to 200 evidence sentences before it. Each pair in that sentence with `m` intervals is one check. It is inside when `|logSum/m − (expected + gap)| ≤ RANGE_Z · sqrt(variance + sigma2/m)`.
   - **The rule.** Take the checks from the most recent `W` checked sentences. Once at least `K` sentences have been checked, coverage below `T` stops suggestions. The coach then says the model's expectations do not fit this typist's recent typing, and Suggested runs General.
   - **Constants.** For now use `W = 20`, `K = 8` and `T = 0.70` as named constants.
   - **From C1c.** C1c is calibrating `T` on validation typists and writing a Python parity fixture for this check, `ml/fixtures/fit-check-parity.json`. I will send both when they are ready; you then add a parity test and set `T`.
5. **Speed beyond the data.** The model's speed support `[low, high]` is in log ms. As `12000 / exp(speed)` it is about 32 to 150 WPM. If the speed estimate is outside it, say so plainly: the typing data the model learned from covered about 32 to 150 WPM, so expectations at this speed are extrapolated, and the fit check decides whether they hold. Owen types about 190 WPM.
6. **Words.** Claim only what was measured.
   - Good: "Your *th* is about 18% slower than expected at your speed, from 64 timings."
   - Never imply that practising it will help. Whether it does is what the planned practice trial tests.
   - Convert log quantities for display, for example `expm1(gap)` as a percentage.
   - Show the top three personal gaps as plain text, not a heatmap: the largest `gap` among pairs with at least 2 observations.
7. **Lab readout.** One short block with three things:
   - the speed estimate, and whether it is inside the model's range;
   - the fit check's coverage, with the number of checks and sentences;
   - the top three gaps.
8. **Remove the old rule.**
   - Remove what the new coach makes dead: the `clean-pair-contrast-v1` decision code and `coach-config.json`, the baseline gate and its counters, certified v1 plans, the finite-plan Suggested runtime, and their tests.
   - Keep reading old saved results. Finite-practice and timed results saved by earlier versions must still load and show in Progress and history, without migration.
   - Keep the IndexedDB database `typeforge` at version 3 with all its stores. `coachMembership` and `coachMetadata` may stay unused. Never delete a user's stored data.
9. **Engine edge cases (from C1a).** C1a's tests record two cases the engine keeps but A2 drops: a Backspace on an empty buffer, and a Delete at the end of the text.
   - Check in Chromium whether the browser delivers them to the engine as edits.
   - If it does, flag the sentence (`edited`) and turn the two known-difference tests into matches.
   - If it would need new key handling, leave the engine alone and say so.

## Process

1. **Survey first.** Read the current coach code (`coach-*.ts`, `finite-practice*.ts`, `profile.ts`, the coach parts of `app.ts`, their tests and `tests/browser/coach-app.mjs`). Then send me one `ask` containing:
   - what you will remove, keep and change, with files and roughly how many lines;
   - the evidence filter, including the quality flags you skip, and the schema change for rule 3;
   - where each new piece of text appears;
   - screenshots at 1440 and 390 of the main states, even as rough prototypes: no pair yet, a suggested pair with its reason, the fit check failing, and the Lab readout.

   Wait for my approval before the large removal.
2. **Implement.** Keep `npm run check` green. Rework `tests/browser/coach-app.mjs` so its real phase covers the new flow:
   - no pair;
   - an issued pair;
   - the fit-check fallback;
   - a reload keeping the state;
   - drills not counting as evidence.

   `typing-flow` and `tests/browser/p3-regressions.mjs` must still pass in Chromium on port 5346.
3. **Final screenshots.** Include screenshots at 1440, 390 and 320 of the same states in your report.

## Owned paths

`typing-app/client/src/**` and `typing-app/client/tests/**`. `ml/**` is read-only. Do not change `coach-model.ts`'s math or the generated table; if you think either is wrong, ask.

## Done when

- **Checks pass:** `npm run check`, plus Chromium on port 5346 for the reworked coach suite, `typing-flow` and P3.
- **Report:** at most 80 lines in `artifacts/C1b.md`, not committed. It gives what changed, what was removed, the checks with counts, the screenshots and open risks.
- **Then** send `worker_done`.
