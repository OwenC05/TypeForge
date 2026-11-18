# Prototype evidence (r2): provenance, results and limits

All data are **simulated fixtures** (`prototype/fixtures.ts`). Nothing here is a user observation, a measured effect or evidence that practice helps. r2 replaces the frozen r1 captures. The r1 evidence remains in Git at `dd37652`, and the independent review's evidence is at `05a6767`, unchanged.

## Source and build identity

- Branch `OwenC05/tf-baseline-ux`. The prototype imports the production stylesheet read-only from `typing-app/client/src/style.css` (sha256 `aea2a41c…69c`, unchanged by this lane) and adds `prototype/baseline.css`. Controls are the shipped `@ui-sdk/web` 0.1.0-beta.3 components (segmented control, switch, collapsible, progress). No dependency was added.
- Source sha256: `copy.ts e4fa39fb…42e2`, `fixtures.ts 58a2b469…843b`, `proto.ts c3569b71…7898`, `baseline.css 5fd7a6aa…2852`.
- Build: Vite 8.3.1 from the client lockfile. `tsc -p prototype/tsconfig.json` passes. The output is `index-BADpSMsf.js` (sha256 `5f84f6c8…bfff`) and `index-BSuNlSNP.css`. A fresh rebuild into scratch reproduced the same JS hash. `dist/` is gitignored.
- The frozen comparison build is the same config built from the unchanged `dd37652`/`fa9eca1` sources into scratch. It gave `index-4NBWDmGF.js`, the identical name to r1's recorded build.
- Server: `vite preview --host 127.0.0.1 --port 5312 --strictPort` as hidden background tasks owned by this session (revised build, then frozen build, one at a time). Each was stopped by this session, and 5312 was confirmed free afterwards. Root 5301, H3 5317, review 5318 and P3 5319 were not touched.

## Browser runs

Headless system Chrome 157.0.8103.79 via `playwright-core` 1.65.1 in the session scratchpad (not a project dependency). Every page uses a fresh browser context.

| Script | Result | Output |
|---|---|---|
| `scripts/regressions.mjs` | **Named regressions for findings 1–8 and the finite end, written before the fixes.** Frozen build: **12/85**. The 12 that pass are guards expected to pass on both builds: unchanged first visit, Enter after the save, and no median below ten or after reset. Revised build: **85/85**. | `regressions-before.json`, `regressions-after.json` |
| `scripts/capture.mjs` | 38 states × 3 viewports (1440×900, 390×844, 320×640) plus 6 forced-colour states × 3 = **132 captures**, plus 8 full-page captures of the final results and plan end at 390/320. **0 page errors, 0 horizontal overflow, 0 clipped slots, 0 `undefined`/`NaN` text.** It records focus, label, slot text, progress ARIA, Suggested-key ARIA, primary-in-view and scroll offset. | `states.json`, `states-list.json`, `screenshots/`, `sha256.txt` |
| `scripts/keyboard.mjs` | Author flows **45/45** (15 × 3 widths). K6 is updated because retry saving is now the focused primary and Enter retries. | `keyboard.json` |

`fast=1` checks (regressions REG-3b and REG-5/9, keyboard K4–K8) run the prototype clock 10× faster and are labelled. Typing uses real key presses into the native textarea. Save delays (`save=ms`) and failures (`outcome=savefail`, `retry=fail`) are simulated.

**Save-failure visibility (finding 6).** On failure, `#primary` = *retry saving ↵* is focused and inside the viewport at all three widths, including in forced colours. At 1440 and 390 no scroll is needed. At 320×640 the browser's focus scroll moves the page 413 px to bring the focused primary into view. The person does not scroll, but the result header is above the fold. This matches the accepted result behaviour for focused primaries.

**Inspected by eye:** 320 assessment with qwerty off and the declaration key (iterated twice until it fit the slot), 320 save-failed, 1440 final insufficient with the summary, 320 final ready (full page), 390 Progress summary, 390 deferred why?, 320 recovery in the ready slot, 1440/320 plan end, 390 forced-colour result and save-failed.

**Defects found and fixed during r2:** the qwerty hint with its key clipped the 320/390 slot (copy shortened twice). `.baseline-block p` overrode the micro label and fixture-caption sizes. The failed-save note repeated the save-row sentence. Under forced colours, progress filled versus empty differed by hue only (now a shape difference). The plan-end result showed figures before P1 validation (now omitted, per `finite-plan-end.md` rule 6).

## Limits

- This is a simulation of the UI contract. It is not the production engine, storage, bounded reads, revision proofs or the P1 selector. The reload case of contract rule 4 is described, not executed.
- Testing used one engine, headless Chromium, with emulated viewports and forced colours. There was no Firefox/Safari, physical device, IME, screen reader, Windows High Contrast theme or human participant. Comprehension is not tested, so the review's criterion 10 (a human check) is still open.
- Full-page captures show the production skip link stitched mid-page. That is a capture artifact of `position: fixed; top: -100px`, and viewport captures do not show it.
- The fixture label is prototype chrome.
