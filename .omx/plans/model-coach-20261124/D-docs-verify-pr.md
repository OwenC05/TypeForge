D Docs, full verification and a PR draft (plan phase D: D2 and D3)

Read `.omx/plans/model-coach-20261124/common.md` and `plan.md` first, especially D9, D12, D13 and phase D. You are worker D. Use port **5347** for browser runs; each engine gets its own `COACH_OUT` directory (`typing-app/client/tests/browser/README.md`). Python runs in WSL as `common.md` describes. WSL is currently unreliable: a startup timeout (`Wsl/Service/0x8007274c`) never reaches Python, so wait 30 s and launch again, up to 10 times.

Owen's direction: keep TypeForge lean. Correct what is stale and say what is true now. Add no new documents, badges or sections for show.

## Why

Since `main` (last commit 5 October), this branch has rebuilt the coach.
- Suggested practice now chooses pairs with L5.
- L5 passed a registered fresh test (`ml/coach/REPORT.md`, "Fresh test").
- The fit check was calibrated on validation typists ("Fit check").
- The old 10-test rule is gone.

Several documents still describe the old coach. For example, `README.md` line 3 says Suggested needs "ten qualifying 30-second QWERTY assessments". Owen will decide whether to ship this branch, so he needs accurate docs, a full verification run and a PR description he can read in a few minutes.

## Work

1. **`README.md`** (one screen; keep it about as short as it is).
   - Describe Suggested as it now works. It names a letter pair that your saved typing shows is slower than expected at your speed. It stays General when the evidence is thin, when the model does not fit your recent typing, or when QWERTY is not declared.
   - Add one results line for the coach model next to the existing Ridge line, in D12's terms. On 16,659 held-out typists (4,240 scored), L5 predicted later pair timing better than the typist's own average: MAE 0.204 against 0.288 log ms, paired 95% interval for the reduction 0.079–0.088. It does not show that practising those pairs helps; the planned trial tests that.
   - Check the two screenshots. Retake one only if it shows UI that no longer exists or would mislead; use the production build at 1440 with realistic data typed through the harness.
2. **`docs/product.md`**. Replace the old coach's description (baseline gate, ten tests, finite plans, the contrast rule) with a short, accurate one. Cover:
   - the evidence (QWERTY assessments and General practice; drills excluded; latest 200 clean sentences);
   - the decision;
   - the Pair-mode block;
   - the fit check (latest 20 checked sentences; active from 8; below 70% Suggested runs General);
   - the Lab readout;
   - the limits (QWERTY full-size and laptop keyboards; training speeds about 32–150 WPM with extrapolation beyond; prediction, not proven practice benefit).

   Delete dead text rather than rewording it.
3. **Model card (D2).** Add a short section to `ml/README.md`, at most about 30 lines:
   - what L5 is (pair-by-speed expectation plus a shrunken personal gap);
   - the training data and filters;
   - the registered evaluation and result, with denominators and the interval;
   - the fit check and its calibration;
   - intended use (choosing practice pairs in TypeForge and in a trial);
   - limits;
   - links to `ml/coach/PREREG.md`, `REVIEW.md` and `REPORT.md`.
4. **Other stale text.** Search `README.md`, `docs/` (except `docs/process/**` and `docs/pilot/**`), `ml/README.md` and user-facing strings in `typing-app/client/src` for the old coach: "ten", "10 tests", "baseline test", "clean-pair-contrast", "finite", "certified", "pilot".
   - Fix stale docs.
   - For code strings, report them; do not change code.
   - Do not edit `docs/pilot/**`. The trial design waits on Owen. List any statement there that the new coach makes stale.
   - Update `docs/verification.md` only where it records checks that no longer exist or now differ.
5. **Full verification** from a clean build of this branch:
   - `npm run check`;
   - Chromium: coach real phase, `typing-flow` and P3;
   - Firefox and WebKit: coach real phase and P3. You may install Playwright browser binaries into the user cache; never add Playwright to `package.json`;
   - `python -m unittest discover -s ml/tests` in WSL.

   Record each command and its counts. If a check fails, do not fix code. Send me an `ask` with the failure and wait.
6. **PR draft** in `artifacts/PR.md`. Do not commit it, push, or open a PR.
   - A title of at most 70 characters.
   - A body Owen can read in five minutes:
     - what changes for users;
     - what was tested, with counts;
     - deployment notes: IndexedDB version 2→3 upgrade, existing records count as coach evidence, nothing is migrated or deleted;
     - risks, including narrow screens breaking words mid-line, 190 WPM being beyond the training speeds, and practice benefit being unproven;
     - what Owen must do to ship (push, open the PR, merge; merging to `main` deploys production).
   - Base the scope on `git log main..HEAD` and the plan files. End the body with the line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## Owned paths

`README.md`, `docs/product.md`, `docs/verification.md`, `docs/screenshots/**`, `ml/README.md` and `artifacts/**` (uncommitted). Everything else is read-only, including all code and `docs/pilot/**`.

## Done when

- The docs are committed on your branch, and every check in step 5 has been run and recorded.
- Your report is in `artifacts/D.md`, at most 60 lines: what changed, check results with counts per engine, stale code strings or pilot statements found, and the path of `artifacts/PR.md`.
- Then send `worker_done` as `common.md` describes.
