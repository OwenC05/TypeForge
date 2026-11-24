A4 Fix the two P3 UI issues recorded in the 18 November acceptance, red then green

Read `.omx/plans/model-coach-20261124/common.md` and `plan.md` first. You are worker A4. Port 5341.

The source of truth is the "Ranked remaining follow-ups" table in `docs/implementation/2026-11-16/baseline/acceptance.md` (rows 1 and 2). Read those rows in full, and the surrounding code, before changing anything.

## Issue 1 (P3, confirmed): first-key invalidation race

During the narrow first-key invalidation race, the sentence can change before the key typed for the old sentence is scored, charging an undeserved first-attempt error. General still starts once and the baseline is unaffected. Acceptance criteria from the record: reproduce it using the character of the previously visible sentence; preserve honest input and measurement semantics and native focus; show no false scored error after invalidation; do not revive the stale Suggested plan and do not merely test the replacement sentence's character. Decide the interaction yourself within those bounds (for example, the key that arrives during invalidation is not scored against a sentence the user could not see), and explain the choice in your report.

## Issue 2 (P3, confirmed copy): wrong provenance tag

A Suggested block that reaches the timer uses the ordinary timed schema; its full results-page fallback tag says GENERAL PRACTICE although it ran a focused plan. Use the provenance-neutral label PRACTICE for timed records without explicit manual or recommended metadata. Verify General, timer-ended Suggested, manual, assessment and legacy explicit-focus results, without inventing persisted provenance.

## Method

- For each issue, first commit a failing test (Node test in `typing-app/client/tests/`, plus a browser check when the bug needs real input timing), then the fix, then the passing state. Keep red and green as separate commits.
- Browser regression in a new file `typing-app/client/tests/browser/p3-regressions.mjs`, following the conventions in `tests/browser/README.md` (synthetic IndexedDB name, isolated context, hidden preview server on port 5341 with `--strictPort`). Avoid editing `coach-app.mjs` and `typing-flow.js`; if a tiny shared-helper export is unavoidable, keep it minimal and say so.
- No visual redesign and no new copy beyond the label.

## Owned paths

`typing-app/client/src/app.ts` (practice input handling and results label only), `coach-ui.ts`, `finite-practice.ts`, `finite-practice-result.ts`, `engine.ts` only if the race fix requires it, their tests, and `tests/browser/p3-regressions.mjs`. Another worker (A6) edits the Lab rendering in `app.ts` at the same time: keep your `app.ts` changes local to the code paths above.

## Done when

`npm run check` passes; the new browser regression passes; the existing `COACH_PHASE=real` and `typing-flow` checks still pass in Chromium (state counts). Report at `typing-app/client/tests/browser/P3-REPORT.md` (short: cause, fix, evidence, commits). `worker_done` per common.md.
