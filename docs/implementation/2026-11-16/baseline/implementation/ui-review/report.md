# F UI independent acceptance review

Task `task_a5b737f7f6e0` · dispatch `ctx_c2772a13991f` · reviewer: Claude Code, `claude-opus-5-5`, effort `high`. Model and effort are read from the argv of this session's ancestor `claude.exe` (PID 73392); I cannot verify them from inside the model.

## Verdict

| Pin | Verdict for the F UI scope |
|---|---|
| Frozen candidate `6520e39` (app.ts `f1f7fac`) | **REVISE.** I reproduced the known fallback-prompt defect in a real browser on two occasions. |
| Corrected pin `6126ad4` (cherry-pick of `62e534a`; app.ts `9353263`) | **APPROVE.** Two P3 follow-ups remain, neither blocking. |

On the corrected pin, both General fallbacks display, run and save their own General selection:

- **Settle fallback.** Deleting a counted test while a Suggested tab is open: what the stage displays, what runs and what is saved are identical.
- **First-key fallback.** A real `storage` invalidation, and separately a real reset through C, landing before the first key. In each case the first key is accepted once, the label and slot are honest, and focus stays in the text. The saved `promptIds` equal the displayed General sequence exactly.

The wider UI passes, with no page errors in any of the independent runs.

## Ranked findings

| # | Severity | Finding | Impact | Confidence | Source |
|---|---|---|---|---|---|
| 1 | **P1 on frozen; closed on corrected** | General fallbacks ran the th plan | See the expected/observed note below this table. | High | `screens-frozen-6520e39/320-22-first-key-fallback.png`, `review-prod-frozen-6520e39.json` (KNOWN-F); corrected: `review-prod.json`, `review-firstkey.json` |
| 2 | P3 | First-key fallback: the stale first character is scored against a different sentence | See the expected/observed note below this table. | High (2 of 2 real runs) | `review-firstkey.json`, observation `firstkey-*-first-character`; `screens/1440-24-first-key-reset.png`, `screens/320-24-first-key-storage-event.png` |
| 3 | P3 (copy) | A timer-first Suggested block is tagged "GENERAL PRACTICE" on the full results page | The tag reads "GENERAL PRACTICE" for a block that ran th sentences. | Medium | `app.ts:1485`; `review-prod.json` observation `timer-first-results-page` (promptBanks `th-plan`); `screens/1440-17-results-timer-first.png` |
| 4 | C lane, unconfirmed | Intermittent `Failed to execute 'abort' on 'IDBTransaction': The transaction has finished.` | Replay-only (F's harness run 1 failed at assertion 50; run 2 passed 50/50). | Low | `replay-ui-sdk-agent.txt`; not seen in `review-dev.json` (400 focus invalidations, 0 errors) |

**Finding 1, expected versus observed.**
- Expected: a "General practice" block displays, runs and saves General prompts.
- Observed on frozen `6520e39`:
  - The label switched to General, but the stage kept "we take the short path beside the river" (th plan). The metadata's first id was `practice-024`.
  - The saved record has ids `practice-002/072/053` (settle path) and `practice-002, 072, 053, 003, 036, 054, 034`, all from the th plan.
- Fixed by the `62e534a` cherry-pick; no further remedy is needed.

**Finding 2, expected versus observed.**
- Expected: the first key is accepted once, and the person is not charged for a mistake they did not make.
- Observed: the person types "w" for the th sentence on screen. That key starts General on "the blue notebook…" / "the green scarf…", and the "w" is recorded as a wrong first character: the red correction mark, and accuracy 99.6%.
- F's unit test (`app.test.ts`, added in `62e534a`) types the *new* sentence's first character, so it does not cover this.
- Impact: in a rare race window (an invalidation before the first key), the sentence visibly swaps under the first key and costs one first-attempt error. The block is General practice, so the baseline is unaffected.
- Minimal remedy, for root or UX to choose: either put the General selection in place when the invalidation arrives, before any key is pressed, or consume the triggering key without scoring it. Do not revert to the th prompts.

**Finding 3, expected versus observed.**
- Expected: provenance-neutral copy.
- Observed: the tag reads "GENERAL PRACTICE".
- `ux/finite-plan-end.md` rule 9 sanctions saving this as an ordinary practice result, and the tag line predates F (`93f5631`). It is still F's flow that now produces it.
- Minimal remedy: show a neutral `PRACTICE` tag when a practice result carries neither `practiceFocus` nor `manualDrill`.

**Finding 4.**
- The likely site is the abort listeners in C's storage (`coach-storage.ts:421`, `storage.ts:541/545`). Calling `tx.abort()` there after the transaction has finished throws.
- Minimal remedy (C, through root): guard the listener's `tx.abort()` with try/catch. This is not an F UI defect; keep it with C's tracked storage errors.

**Observation, not a finding: count lag.** After a non-final test's save is confirmed, the baseline count can show N−1 for a few refresh rounds before reaching N. It always converged on every successfully saved test (`review-prod.json`, `baseline-per-test.lag`). Test 10 stayed at 9 because its save was deliberately faulted, which is correct.

## Acceptance matrix (corrected pin unless noted)

How to read the evidence column:
- **Independent** means my own harness (`probes/review.mjs`) drove a real browser against a fresh synthetic database. It used native keyboard and pointer input, with no injected statuses, admissions or proofs.
  - *real-fault* means a genuine IndexedDB `readwrite` throw.
  - *emulated* means CDP media emulation.
- **Replay** means F's own harness, re-run by me.
- **Source** means a read-only check of the source.

| WP | Criterion | Independent result | Evidence kind | Replay / source |
|---|---|---|---|---|
| WP1 | A1: first visit ready at 1440, 390 and 320 (focus, General 30 s, first key, Backspace, caret) | Pass | real | — |
| WP1 | A3: locked Suggested by keyboard and press keeps the kind; one action; within the 75-character budget | Pass | real | — |
| WP1 | Duration 60 and manual pair change honestly | Pass on inspection. The harness expected "General", but its earlier ArrowRight step had already selected *pair*, so "Pair practice · th · 60 s" is correct (`review-prod.json` WP1 detail). | real | — |
| WP1 | Layout: no overflow, no clipped key, no undefined/NaN at 1440, 390 and 320 | Pass. All ten first-key layout checks pass (`review-firstkey.json`); every layout check in `review-prod.json` passes. | real | — |
| WP1/WP5 | A12: why? states 0 of 10, what counts, "about five minutes of typing", and the source | Pass | real | — |
| WP2 | Ten-test baseline; test 4 interrupted (A7, not counted); reload after test 5 keeps the count | Pass | real | replay 50/50 (run 2) |
| WP2 | A6: tenth test with a failed save leads to *retry saving* as the focused primary; ET-1 leaving guard; retry succeeds and completes the baseline (A9) | Pass | real-fault | replay |
| WP2 | A6 at a native 320×640 page (no resize): the failed-save primary is focused and in view | Pass (top 319, bottom 371 of 640) | real-fault | `review-native320.json` |
| WP2 | Deleting a counted test lowers the count (A8/REG-2e); reset in another tab gives 0 of 10; reload agrees (K10, A11) | Pass | real | — |
| WP3 | Recommendation leads to practice: "try suggested · th ↵" focused after the tenth test; Suggested ready label | Pass | real | — |
| WP3 | why? copy: "300 ms against 110 ms, across 48 clean th transitions in 6 different words and 10 runs" | Pass | real | — |
| WP3 | Plan sentences contain the pair; the finite end | Pass. 12/12 sentences for he/in/le/th contain their pair. Finite end reads "all 12 sentences done at 16.8 s of 30" with the end marker; the flagged finite end is labelled and excluded. | source + real | `probes/plans.json` |
| WP3 | 60 s mismatch and [use 30 s] (A23/D2a) | Pass | real | — |
| WP3 | Timer first is the ordinary practice result | Pass on the stage; see finding 3 for the results-page tag | real | — |
| WP4 | Settle fallback: displayed, running and saved ids are General | Pass. Displayed `practice-010` "i left a note beside the bowl of fruit"; saved `practice-010/039/063`. Frozen: **fail** (finding 1). | real | — |
| WP4 | First-key fallback through a real `storage` invalidation, before the queued re-check | Pass: label "General practice · 30 s", re-check copy, value of length 1, focus `typing-input`. Saved `practice-050, 063, 032, 006, 043, 013, 052` equal the displayed sequence. | real | — |
| WP4 | First-key fallback through a real reset committed by C in another tab | Pass: saved `practice-035, 013, 008, 051, 072, 068, 079` equal the displayed sequence | real | — |
| WP4 | A late save never moves focus or changes an active block; rapid Again keeps pending results (ET-1) | Pass | real / real-fault | replay |
| WP5 | Tab order from the textarea | restart → skip link → brand → nav (4) → duration → practice kind → qwerty → why? | real | — |
| WP5 | Visible focus indicator on rail keys | Pass (cobalt ring, visually inspected) | real | — |
| WP5 | Reduced motion: no cursor animation | Pass | emulated | — |
| WP5 | Forced colours: selected and empty progress stay distinct and legible | Pass (visually inspected, 1440 and 320) | emulated | — |
| WP5 | Page errors | 0 in prod, firstkey, native320 and dev (400 focus-invalidation attempts) | real | replay run 1 shows finding 4 |
| WP5 | Bounded load (real clock, no throttle) | Textarea focus at 341 ms, status at 393 ms; 275,263 bytes of script | real | — |

**Superseded or harness-only results, kept as archives:**
- **Frozen run** (`review-prod-frozen-6520e39.json`), 82/110. About 24 of its non-KNOWN failures came from a harness `innerText` uppercase bug, since fixed. Its KNOWN-F failures compare raw prompt text and remain valid.
- **Corrected prod run** (`review-prod.json`), 107/110:
  - WP1 is explained in the matrix above.
  - The `WP4/P1a` and KNOWN-F first-key rows were not isolated: the shared page clock ran the queued re-check first, so the label was already General before the key. The bank classifier is also ambiguous, because th-plan ids are practice ids.
  - Both are replaced by `review-firstkey.json`, which passed 14/14.
- **`review-firstkey-attempt1-*`:** a harness URL bug (qwerty not declared).
- **`review-firstkey-attempt2-*`:** headless `bringToFront` fires no window `focus`, so there was no invalidation. The app correctly kept the admitted th block; this is not evidence for the fallback.

## Screenshots visually inspected

**Frozen (`screens-frozen-6520e39/`):**
- 1440 and 320 first visit
- 320 locked press
- 320 assessment declare
- 1440 forced colours
- 320 failed tenth
- 390 baseline complete and progress complete
- 320 Suggested why?
- 390 plan end
- 320 at 60 s
- 1440 after deletion
- 320 first-key fallback (shows the defect)

**Corrected (`screens/`):**
- 320 Suggested ready
- 320 flagged plan end
- 320 reset done
- 1440 timer-first results
- 320 native failed save
- 1440/320 first-key reset and storage-event fallbacks

Everything inspected is coherent with the accepted look: quiet controls, a reserved slot region and a visible focus ring. There is no clipping, apart from the documented slot cut-off in attempt 1, where the harness had not declared qwerty.

## Receipts

**Source.** Worktree `tf-coach-ui-review`, branch `OwenC05/tf-coach-ui-review`.
- Frozen root `6520e39ccb00c561ee45df39a1cd8e41feb0cf6d`.
- Corrected HEAD `6126ad448d204afb46f72d009439846e0e2ba05c`: a cherry-pick of `62e534a76fb8206196d37d15810e2c1b65bad188` only. Its app.ts blob `9353263540cef3a29d22af63780819916d6106a9` matches the coordinator's pin.
- The other F blobs are unchanged: coach-ui `d5f8fe0`, finite-practice `727e469`, style `1ec6c13`, unsaved `c414080`.
- Full trees: `source-pins-before.txt` and `source-pins-corrected.txt`.

**Build.**
- Corrected source: `npm run check` gives 234/234 tests, `tsc --noEmit` and Vite 8.3.3 → `app-BBeH2puV.js` (sha256 `4ba1d1c4…6d63c`) and `app-Ut7hJad6.css` (`full-check-corrected.txt`).
- Frozen source: `app-DpuPv2HI.js` (sha256 `bef95969…69fda`); 233/233 tests.

**Runtime.**
- Native Windows 11, Node v24.21.0, system Chrome 157.0.8103.79 headless.
- Driven by playwright-core 1.65.1, installed only in the session scratchpad and not a repo dependency.
- Paused page clock, with real-time waits where C commits.
- Viewports 1440×900, 390×844 and 320×640.

**Helpers.** Each run used a hidden `node node_modules/vite/bin/vite.js [preview] --host 127.0.0.1 --port 5326 --strictPort` with `shell:false`, cwd `typing-app/client`.

| Run | Server PID |
|---|---|
| frozen | 6396 |
| prod | 20384 |
| native320 | 67208 |
| dev (`vite` dev server) | 64356 |
| firstkey attempt 1 | 36968 |
| firstkey attempt 2 | 51720 |
| firstkey final | 70824 |

Each run's `*-helper-receipt.json` records SIGTERM and that port 5326 was free afterwards. After the last run I re-checked: every PID is gone and there is no listener on 5326. The remaining headless Chrome processes belong to an unrelated Codex Playwright MCP and were not touched.

**Data.** Every world used a fresh database named `typeforge-review-synthetic-<uuid>`, verified before the app first touched storage. `deleteDatabase` and every other database name were refused. The real `typeforge` database, the original checkout and Portfolio were never opened. Nothing was uploaded, deployed or pushed, and no paid service was used.

## Limits

- Chromium only; no Firefox or WebKit.
- No screen reader, no OS IME or dead keys, no physical device or touch keyboard, no browser zoom or 200 % text.
- Forced colours and reduced motion are emulated only.
- Typing timings are scripted under a paused clock, so the plan-end and WPM values are synthetic.
- I could not trigger the focus-return invalidation with headless window focus. The first-key path is closed through the `storage` and real-reset channels instead.
- Finding 4 is replay-only and not reproduced.
- AGENTS.md is absent from every workspace.
- F was authored by Claude sessions on the same account. This review used its own harness, but it is not a different-vendor review.
- Author claims (19/19, 39/39, 42/42, 120/120, 234) are recorded separately and were not used as evidence. 234/234 was re-run by me.
