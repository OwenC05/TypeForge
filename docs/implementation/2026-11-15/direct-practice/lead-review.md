# Lead review: direct practice "Paper and ink" (T6)

16 November 2026 · actual Claude design lead (`claude-opus-5-5`; requested effort high, applied effort unknown) · Task `task_6815dfce6ce4`, Dispatch `ctx_fa2dac9b8663`.

**Reviewed:** T4 frozen at `0747d17` on `OwenC05/tf-direct-practice`. Final source is `1e29064`. `git diff --quiet 1e29064 0747d17 -- typing-app/client/src` holds.

**Verdict:** accepted at **`db56cf0`** (final source `932f000`) after the one required presentation fix, **L-1**, landed and was independently verified (see Final acceptance). Previously: accepted at `0747d17` except L-1.

## Method

Independent of T4's harness and captures:

- **Source.** `git archive 0747d17` of `typing-app/client` and `ml/` into the lead scratchpad, then `npm ci`.
- **Build.** The rebuild produced the same `app-Dcu90w2F.js` and `app-7HF6yCwN.css` as T4's receipts. Served by `vite preview` on port 5303 (`--strictPort`, hidden, tracked by PID).
- **Browser.** System Chrome through playwright-core, fresh profiles `dp-lead-*` in the lead scratchpad.
- **Time and input.** Real time throughout, with no Playwright clock. Real keystrokes into the native textarea.
- **Save failure.** Injected only at the storage boundary: `IDBObjectStore.add` throws for the results store.
- **Scripts.** `lead-review/scripts/lead-review.mjs` and `ctx-wrap.mjs`.
- **Captures.** In `lead-review/captures/`, with `sha256.txt`.

`lead-review.json` holds only the second, save-failure run. The first run's values are quoted below from its console output.

### First `npm run check`

- From a `typing-app/client`-only extraction, the result was 125 of 126.
- The failure was `model.test.ts`, with `ENOENT` on `../../../ml/fixtures/parity.json`, a file outside that folder. This came from how I extracted the source, not from the product.
- After adding `ml/` from the same commit: **132/132 pass, 0 skipped**; typecheck and build pass.

## Journey checks (observed)

| Journey | Viewport | Observed |
|---|---|---|
| Clean first visit to `/` | 1440, 390, 320 | URL stays `/`. Focus in `typing-input`, stage `idle`, duration `30`, kind `general`. No cover, no horizontal scroll, 0 page errors. |
| First key starts the run | 1440, 390, 320 | One keypress gives value of length 1, stage `running`. No click needed. |
| Error and correction | 1440 | Typed `#` at a word end: vermilion expected-glyph tag plus wavy underline; caret placed right. Backspace and continue: clean, stage still running. |
| Optional setting | 1440, 390 | The `15` key sets duration 15. Focus stays on the key, which is intentional and not stolen. A click on the passage returns focus to the input. |
| Block → in-place result → repeat | 1440, 390 | The result renders in place with focus on **again**. Enter starts a fresh idle block with focus in the input, still at 15 s. |
| Return visit | 1440, 390 | Reloading `/` restores 15 s (remembered), focused and ready. |
| Save failure | 1440, 320 | The failure row has the lead's treatment (`savefail-1440.png`). Again continues immediately. The slot shows `1 result not saved` with retry save, export and discard. During a run it shows the count only. |
| Held departure during a run | 1440 | Clicking topbar `progress` stays on the page. The line reads "1 result not saved. Leaving this page loses it." with Export focused. Export downloads `typeforge-unsaved-1-results.json`. **leave without saving** goes to `progress.html`. 0 page errors. |

## Target comparison (width-normalised, per `target/inspection.md`)

**1440 running with error** (`running-error-1440.png` vs `target-1440-running.png`). Matches:

- The material, the heavy countdown numerals with the mono label, and the ink passage with graphite remainder.
- The vermilion expected-glyph tag with wavy underline.
- Restart sitting on the slot rule.
- The topbar dimmed while running.

Differences:

- The direction's smaller sizes (accepted in T4's receipt).
- The restart label is set in the sans face, not mono (minor, accepted).
- No previous line on the first sentence, which is expected.

**1440 result** (`result-1440.png` vs `target-1440-result.png`). The structure matches throughout:

- the rail, the today line, the rule and the complete label;
- the numerals with their units and the miss sentence;
- **again** focused with its note, `details`, and the save status on the right.

The numerals are smaller than the generated target; this is an accepted difference.

**390 ready** (`first-390.png` vs `target-390-ready.png`). The rail (two rows), header, countdown row, passage, hint, restart and footer hints all match. **The one material difference is wrapping:**

1. **Active line breaks mid-word** ("unt / il"). This is a contract limit, not a defect to fix here.
   - The native textarea holds only the typed prefix. With word-safe wrapping, a partly typed word would sit on a different row from its passage word.
   - T4's geometry matrix measured exactly this: word-safe wrapping fails 8 cases and 11 sweep widths; break-all keeps caret and selection agreement.
   - It stays documented. Removing it would mean weakening native editing, which the brief forbids.
2. **Upcoming line breaks mid-word** ("sprin / g"). **This is fixable (L-1).** See below.

## Finding L-1 (required, presentation only)

**What and where.** `.passage-context` (`#previous-prompt`, `#next-prompt`) shares the editor's `word-break: break-all; overflow-wrap: anywhere` rule at `typing-app/client/src/style.css:128-129`.

**Why it is safe to change.** These lines are `aria-hidden`, `pointer-events: none`, and not editable. They take no part in textarea/mirror hit-testing. So the native-editing reason for break-all doesn't apply to them.

**Effect.** A visibly broken upcoming passage on most narrow first views. Measured on the frozen build over 25 seeded sentences each:

| Width | Upcoming words split mid-word |
|---|---|
| 390 | 17 of 25 sentences |
| 320 | 13 of 25 sentences |

**Lead prototype.** Scratch copy only; T4 source untouched. Remove `.passage-context` from the shared selector and give it `white-space: pre-wrap; word-break: normal; overflow-wrap: break-word`, keeping its other mono metrics. Same 25 seeds:

- **0 split words** at 390 and at 320;
- active-line top unchanged (390: 317 px, 320: 310 px across all seeds);
- no horizontal overflow, 0 page errors.

Evidence: `ctxwrap-390.png`, `ctxwrap-320.png`, `scripts/ctx-wrap.mjs`.

**Required verification by the implementation owner:**

- the geometry matrix shows zero displacement for in-block events;
- the slot fit still holds at 390 and 320;
- the committed-line error marking (`.missed` spans) still renders;
- reruns of states (390/320 ready, running, error), typing-flow, `npm run check` and `visual-evidence.json` with its integrity helper.

This is a CSS-only delta after `1e29064`.

## Evidence and limits reviewed

- **Bundle.** +33.5 KB gzip on the initial entry; within the ~40 KB budget in the T4 spec. Select and sheet chunks are lazy, and `createAgent` is test-only. Accepted.
- **Timing.** Equivalent within noise on a headless single host. No device or human-typing claim is made. Accepted as bounded.
- **200% zoom.** Real `default_zoom_level`; no horizontal overflow. Restart and the slot fall below the fold on a short window. Recorded; accepted.
- **Agent contract.** With the bridge open, `ok: true` means dispatched, not applied. Changes, values and the app status are the truth. Accepted.
- **Recovery.** The in-memory list does not survive tab close, reload or BFCache. This is deliberate, because the brief forbids new response persistence. Accepted.
- **Not covered** (honest gaps, not passes): OS IME, screen readers and AT, Firefox and Safari, physical devices, human typing.

## Housekeeping

- Lead preview on port 5303 is stopped after review (PID recorded in the scratchpad).
- Lead profiles `dp-lead-*` remain in the lead scratchpad. Cleanup is optional, so I left them rather than run an unverified deletion.

## Final acceptance (L-1 delta)

**Commits.** T4 follow-up (Task `task_99e9239f71f9`, Dispatch `ctx_a83524e4db81`): `932f000` (CSS) and `db56cf0` (evidence).

**Delta.** `git diff 0747d17 932f000` touches only `typing-app/client/src/style.css`:

- `.passage-context` leaves the editor's break-all selector.
- It gets `pre-wrap` / `word-break: normal` / `overflow-wrap: break-word`, with the same mono metrics.
- The editor rule (`.prompt`, `.typing-input`) is unchanged.

Client source is identical between `932f000` and `db56cf0`.

**Independent rebuild.** Lead scratchpad, final `style.css`:

- `npm run check`: **132/132**.
- Build: `app-BNPI8kHH.js` and `app-ChsJ1aui.css`, the same as T4's receipt. The JS name changed only because Vite's chunk hash includes the CSS.

**Measured on that build** (`scripts/ctx-wrap.mjs`, same 25 seeds, real time):

| Width | Split words in upcoming line | Active-line top | Overflow | Page errors |
|---|---|---|---|---|
| 390 | **0 / 25** | 317 px, unchanged | none | 0 |
| 320 | **0 / 25** | 310 px, unchanged | none | 0 |

- Clean first visit at 390 and 320 is still ready, focused, 30 s General, with 0 errors.
- The first key starts the run.

Captures: `final-ctxwrap-390.png`, `final-ctxwrap-320.png`.

**Accepted from T4's receipts on `932f000`** (not rerun by the lead):

- geometry identical to `1e29064` (zero displacement, every slot message fits);
- 57 state captures;
- typing-flow 46/46, unsaved 74/74, agent 50/50;
- zoom ok;
- visual receipt and helper ok, 55 files;
- +17 B gzip CSS.

Retry-race, late-history and timing are labelled historical against their own builds. The only source change since then is the context-line CSS, which is outside their paths.

**Remaining honest limits:**

- The active line still breaks mid-word at narrow widths. This is the measured native-editing limit.
- Unsaved-result recovery is in-memory only: it does not survive reload, tab close or BFCache.
- 200% zoom on a short window puts restart and the slot below the fold.
- The bundle grows by +33.5 KB gzip initial.
- Timing evidence is bounded: headless, single host.
- Not covered: OS IME, screen readers and AT, Firefox and Safari, physical devices, human typing.

None of these is claimed as passed.
