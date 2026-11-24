A9 Firefox and WebKit verification of the production build

Read `.omx/plans/model-coach-20261124/common.md` and `plan.md` first. You are worker A9. Port 5344. Your worktree starts from the integration branch after the P3 fixes (A4) were merged.

## Why

Every acceptance run so far used Chromium (Chrome and Edge). Typing input is where engines differ most (beforeinput, input, composition, word deletion, selection replacement, focus), so Firefox and Safari users may hit defects nobody has seen.

## Steps

1. Install Playwright's Firefox and WebKit browser binaries into the user cache if missing. Do not add dependencies to `package.json`.
2. Make the existing browser harness engine-selectable with `BROWSER_ENGINE=chromium|firefox|webkit` (default chromium, behaviour unchanged): `tests/browser/coach-app.mjs`, the runner that executes `typing-flow.js`, and `tests/browser/p3-regressions.mjs`.
3. Run in Firefox and WebKit: the typing-flow check, `COACH_PHASE=real`, and the P3 regressions; record counts per engine. Then explore engine-specific input edge cases by hand through Playwright: Backspace and Ctrl or Alt word deletion, selection replacement, cursor moves, paste and drop blocking, focus loss, Space advance and Enter, the safety stop, timers under throttling, and layout at 1440 and 390 px (screenshots to `artifacts/`).
4. Fix only defects whose fix is local and low-risk, each red then green in separate commits. Anything larger goes in the report with a reproduction.
5. Report `typing-app/client/tests/browser/CROSS-BROWSER-REPORT.md` (at most about 150 lines): engines and versions, checks and counts, defects (fixed or open) with reproductions, and limits: Playwright WebKit on Windows is not Safari, and real Safari, iOS, screen readers and IMEs remain unverified.

## Owned paths

`typing-app/client/tests/browser/**`, plus local compatibility fixes in `typing-app/client/src/**` that you report one by one.

## Done when

Both engines have run every listed check, Chromium results are unchanged, `npm run check` passes, and `worker_done` follows common.md.
