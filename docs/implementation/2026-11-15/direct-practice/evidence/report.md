# Direct practice "Paper and ink": implementation evidence report

16 November 2026 · T4 implementation owner · branch `OwenC05/tf-direct-practice`. Final source commit **`932f000`**: the lead's L-1 fix, CSS only, after the T4 freeze `0747d17`, whose final source was `1e29064`. `1e29064` is itself a CSS-only delta after the independently reviewed `91ca6bc`. Identity of every receipt: `manifest.json`. Preview: `cd typing-app/client && npm run build && npm run preview -- --port 5301 --strictPort`.

## Outcome

No-gate practice works: `/` opens a focused 30 s General block, typing starts the clock, the result appears in place and Again continues immediately. Preserved contracts hold on the final build: native editing, rolling passages, frozen predictions, save/retry/export and the SDK agent contract. Review blockers ET-1 and ET-2, the lead's LR-1/LR-2 and the reviewer's F1–F4 are repaired, with regressions. Where the table says so, a regression was run against the pre-fix source, failed there, and passes now. The independent final source review (17fd86b) closed them on `91ca6bc`. The lead review (f827733) accepted `0747d17` with one required presentation fix, L-1: the non-editable context lines split words mid-word. It is fixed in `932f000` (below). Two items are open on purpose, and none is unresolved in the visual receipt. The first is the in-memory limit of unsaved-result recovery: it does not survive reload or tab close. The second is mid-word wrapping of the active passage (the line being typed) at narrow widths.

## L-1: context lines keep whole words (`932f000`)

**Change.** `.passage-context` (`#previous-prompt`, `#next-prompt`) leaves the editor's shared `break-all` selector. It now wraps with `white-space: pre-wrap; word-break: normal; overflow-wrap: break-word`, with the same mono metrics. The active editor (mirror and native textarea) keeps `break-all` / `anywhere` and its native-editing contract. This is the lead's prototype, applied as written. No script, logic, dependency or storage changes.

**Build.** The new build is `app-ChsJ1aui.css` / `app-BNPI8kHH.js`. The app JS is byte-identical to the `1e29064` build's `app-Dcu90w2F.js` (`fc /b`: no differences). Its name changed only because Vite's chunk hash includes the chunk's CSS. Rebuilding the `1e29064` CSS reproduced `app-Dcu90w2F.js` / `app-7HF6yCwN.css` exactly. `define-element`, `env`, `select` and `sheet-presentation` are unchanged.

**Verification** (`scripts/context-wrap.mjs` → `context-wrap.json`, **33/33**, 0 page errors). Same 25 seeds and seeding function as the lead's `ctx-wrap.mjs`, at 1440, 390 and 320. Real time, real keys. Each seed opens `/`, measures the ready state, then types the first passage with one wrong glyph mid-word and commits it with Space. It runs twice on the same build: once with the shipped CSS, and once with the pre-L-1 rule re-applied by a test-only style.

| Width | Upcoming line, ready: seeds with a split word (shipped / old rule) | Committed line: seeds with a split word (shipped / old rule) | Active line |
| --- | --- | --- | --- |
| 390 | **0** / 17 of 25 | **0** / 11 of 25 | same top as the old rule for every seed, at ready and after commit |
| 320 | **0** / 13 of 25 | **0** / 17 of 25 | same |
| 1440 | 0 / 0 | 0 / 0 | same |

The old-rule counts reproduce the lead's measurement (17/25 and 13/25).

Also checked for every seed:

- the committed line keeps its `.missed` mark with a wavy vermilion underline;
- no horizontal overflow on the page or in either context line;
- the context lines keep the mono metrics (family, size, line height, letter spacing, kerning, ligatures, tab size, pre-wrap);
- the input and mirror still compute `break-all` / `anywhere` / `pre-wrap`.

Captures: `screenshots/ctxwrap-*.png`.

**Geometry** (`geometry.json`, rerun on the L-1 build). The summary is identical to the `1e29064` receipt, and so is every shipped in-block event's active-line top and its stage, surface and slot deltas. Zero displacement holds. Every slot message fits at all three widths. Prompt ids and saved settings are identical across widths. The editor's shipped break-all disagreements are unchanged: 3 native hit-test probes. The rejected word-safe editor mode still fails 8 cases and 11 sweep widths.

## Fresh checks, with the build each one ran on

| Check | Result | Build | Receipt |
| --- | --- | --- | --- |
| `npm run check` (types, 132 tests, build) | **132/132 pass**, 0 fail, 0 skipped; exit 0 | `932f000` source, before commit | console |
| Context-line wrapping (`scripts/context-wrap.mjs`) | **33/33**, 0 page errors | L-1 build | `context-wrap.json` |
| Geometry matrix (`scripts/geometry.mjs`) | identical to before; see above | L-1 build | `geometry.json` |
| States 1440/390/320 (`scripts/states.mjs`) | 57 captures, 0 page errors | L-1 build | `states.json`, `screenshots/` |
| Native typing flow (`tests/browser/typing-flow.js`) | **46/46**, 0 page errors | L-1 build | `typing-flow.json` |
| Unsaved-result recovery (`scripts/unsaved.mjs`) | **74/74**, 0 page errors | L-1 build | `unsaved.json` |
| Real 200% zoom (`scripts/zoom.mjs`) | zoom applied, dpr 2, 0 page errors | L-1 build | `zoom.json` |
| SDK agent contract (`tests/browser/ui-sdk-agent.mjs`) | **50/50**, exit 0 | Vite dev server on the `932f000` source | `agent-test.json` |
| Bundle vs b898dc6 (`scripts/bundle.mjs`) | see below | `932f000` dist | `bundle.json` |
| Visual receipt integrity (ui-taste helper) | `ok: true`, 55 files, 0 errors | captures from the L-1 build only | `visual-evidence.json`, `visual-evidence-verify.json` |
| Delayed retry and rail settings (`scripts/retry-race.mjs`) | **15/15**, 0 page errors | **historical**: `1e29064` build | `retry-race.json` |
| ET-2 late history in the browser (`scripts/late-history.mjs`) | **30/30**, 0 page errors | **historical**: `1e29064` build | `late-history.json` |
| Input timing (`scripts/timing.mjs`) | equivalent within noise | **historical**: `1ad38ca` build | `timing.json` |

"L-1 build" means the dist served on 5301 from the `932f000` source: `app-BNPI8kHH.js` / `app-ChsJ1aui.css`. Retry-race, late-history and timing were not rerun. L-1 changes one CSS rule for non-editable, hit-test-free lines, and the app JS is byte-identical, so the storage, settlement and input-event paths they measure are untouched. `manifest.json` labels each of them with the build it actually ran on.

Every browser harness exits non-zero on a failed check or page error, and records the build it was served. The agent test is the exception: it starts its own Vite dev server on the working-tree source, on port 5301 (`--strictPort`), and records no build name. Earlier versions of this report said it ran "on the same dist"; that was wrong. Test count: 114 before this work, plus `unsaved.test.ts` (9) and `continuation.test.ts` (9).

### Test edits (existing tests), with reasons

1. `tests/app.test.ts` restart context gains `carryUnsaved: () => {}` (d67ab63). The extracted restart slice now calls it; this is context only.
2. `tests/app.test.ts` save-retry context gains a `ResultValidationError` stub (a36a6e3). The catch now classifies before its stale guard; context only.
3. `tests/browser/ui-sdk-agent.mjs` bridge-open case (71201b7). It now asserts the documented cancellation contract instead of accepting either outcome (below).
4. `tests/browser/typing-flow.js` clock setup (8ede09d): `pauseAt(new Date())` became `pauseAt(now + 1 s)`. The page clock started at install could already be past Node's `now` ("Cannot fast-forward to the past"); this failed 1 of 4 final-build runs. It is setup only, no assertion changed, and 3/3 reruns passed 46/46.

No assertion was weakened.

## Review blockers and fixes

| Item | Fix | Regression evidence |
| --- | --- | --- |
| ET-1 (HIGH): continuing could lose an unsaved result | d67ab63: page-scoped ordered list (`src/unsaved.ts`), slot line with retry/export/discard, held in-app departure | `continuation.test.ts` (first 7 tests) fails 7/7 on the pre-fix app.ts (13947ba); browser `unsaved.mjs` |
| ET-2 (MEDIUM): late history re-froze predictions (RangeError) | d67ab63: install once per engine sentence; quiet calibration rejection | host tests; browser `late-history.mjs` fails 4/30 on 39444a5 (idle and native no-op, both URLs), 30/30 now |
| LR-1 / F1: held departure inert during a run | a36a6e3: inert only when not held; returning to the passage cancels the hold | `unsaved.mjs` held-during-run checks (browser; not run against the pre-fix build) |
| LR-2 / F2: late validation refusal listed as retryable | a36a6e3: classify on the record before the stale guard, notify after | test fails on d67ab63 |
| F3: stale retry continuation (TypeError, focus on a replacement) | dc20c85 + 0603960: return unless this block is still current | host test fails on 0ceee2f; browser `retry-race.mjs` on d67ab63 reproduces the TypeError after Again and a rail setting, and stale focus onto the replacement result's Again; 15/15 now |
| F4: permanent stop left Retry disabled | dc20c85: clear queued flags before notifying | `unsaved.test.ts` fails on 0ceee2f |

Browser fault injection stays at the storage boundary: `IDBObjectStore.add` throws, and one `IDBTransaction.oncomplete` is delivered late. Two cases stay host-only, on the actual extracted handlers. A disposal between retry and settlement can't be shown in the browser because the document is gone. `ResultValidationError` can't be produced there because production input is validated before save.

### Unsaved-result recovery: contract and limits

- **Same page:** Again and result-state settings continue immediately. Pending and failed results are kept in order, uncapped. The line says "N results not saved", with retry save (sequential, oldest first, one write per entry), export (all in one file) and discard (explicit).
- **During a run:** the line shows only the count and is inert.
- **Leaving the page** while anything is unsaved: the first in-app link activation is held, with Export focused and "leave without saving". An ordinary second click still holds. If the list empties while held, the hold clears and the next activation navigates immediately.
- **Limits (documented, deliberate):** the list lives in memory only, with no new storage and no beforeunload. Tab close, reload and BFCache restore lose it.
- **Retry with a stored copy:** after a failed write, retry looks the id up. A stored copy is reconciled as saved. This is not a pre-write deduplication: `add()` itself refuses an existing id.

## Agent result vs mutation (for the reviewer)

On the test page with the bridge open, `agent.act` setting duration during a run returns `ok: true`. ui-sdk documents this (`docs/agents.md`, act result): `ok` means no bridge error, and a change callback may cancel without failing the step. So the result means **dispatched, not applied**. The receipt shows what actually happened:

- no duration change on the step
- the unchanged duration in `values`
- the app's status "Agent change to duration refused: a block is running. Finish it or restart first."

The default bridge lock returns `ok: false` for the same request. No mutation is implied anywhere. See `sdk-integration.md`.

## Visual comparison with the targets

Captures at real viewports are compared side by side with `target/` per `target/inspection.md`; there is no pixel-perfect claim.

**Fixed against the targets during this work:**

- the larger vermilion expected-glyph tag (T-3)
- restart on the slot rule (T-4)
- footer hidden while running
- the today line above results only
- the two-row rail at 320
- the active line at 36–40% (1440: 37.7%, 390: 40%)
- the legacy-URL warning now fits the slot
- the failed-save notice treatment (1e29064, the lead's choice)
- whole-word context lines at 390/320 (932f000, lead finding L-1)

**Accepted differences** are listed in `visual-evidence.json`:

- direction sizes (96/32 px) rather than the generated targets' larger type
- a smaller wordmark
- sentence-case save status
- the pair key plus a visible pair trigger
- dashed unavailable Suggested
- no paper grain
- break-all wrapping of the active passage only (the context lines keep whole words)
- native caret hit-testing below the typed text

The pair list opens with the current pair in view, highlighted and focused. An earlier capture showing it at the top was a harness artefact: a paused Playwright clock froze the Select's open sequence. Under real time the product was already correct on every path, including the first lazy open.

### Geometry (1440/390/320, rerun on the L-1 build; identical to the 1e29064 receipt)

- Prompt ids and saved settings are identical across widths, and every slot message fits.
- Every measured event moved nothing: focus loss and regain, hints, the Undo notice and the unsaved line.
- **Shipped break-all:** 44 cases. The only disagreements are the native hit-test probe at index == value.length on a row end (3 cases, 3 sweep widths); the caret and selection agree everywhere.
- **Word-safe wrapping:** 8 case and 11 sweep failures, so it is not shipped.
- Active line at ready: 37.66% (1440), 40% (390), 51.1% (320, 640 px tall).

### Real 200% zoom (rerun on the L-1 build)

Method: Chrome profile `default_zoom_level`, viewport emulation off, CDP capture.

- **Measured:** devicePixelRatio 2, 704×398 CSS px.
- **Passes:** no horizontal overflow, the rail fits, focus stays in the passage, and the expected-glyph tag is in view.
- **Short window:** restart and the slot are below the fold and need a page scroll.
- **Glyph:** the expected-space glyph `␣` renders small inside its tag.

## Bundle and input timing (versus b898dc6)

**Bundle** (`bundle.json`, gzip level 9, regenerated on the `932f000` dist):

- Initial load per page: 39.5 → 73.0 KB (+33.5 KB). L-1 adds 17 bytes gzip to `/` (73,008 → 73,025), all CSS.
- Breakdown: ui-sdk runtime +18.9 KB, app chunk +12.5 KB, CSS +2.1 KB.
- Lazy, on first pair-list open: Select 31.1 KB, sheet presentation 13.4 KB.

**Timing** (`timing.json`, `scripts/timing.mjs`):

- Four alternating rounds of 240 native keystrokes.
- Run alone: after the independent reviewer reported all its workload inactive, with nothing else from this worker.
- `input` handler median 1.1/1.1 ms (final) vs 1.0/1.2 ms (base); p95 2.0/2.2 vs 1.9/2.2.
- `keydown` and `beforeinput` are lower on the final build. Input-to-next-frame medians 5.5/6.1 vs 6.9/4.9 ms.
- Verdict: equivalent within noise.
- Timing ran on the `1ad38ca` build and was not rerun. `1e29064` changes only the failed-save row's CSS and its class. `932f000` changes only the context lines' wrap rule, and its app JS is byte-identical to the `1e29064` build's. Neither touches the input path. The manifest labels those rounds with their own build.
- Headless, single machine; not a device or human-typing measurement.

## Requested versus observed

| Brief item | Observed |
| --- | --- |
| 1. States at 1440/390/320 vs targets; fix and recapture | Done; 57 captures, fixes above |
| 2. Geometry: zero displacement, identical prompts and settings; word-safe only if all pass | Done; word-safe failed, break-all kept |
| 3. Real 200% zoom (A's method), ready and error | Done |
| 4. Bundle per chunk vs b898dc6; bounded input timing alone | Done |
| 5. Agent-result mismatch recorded truthfully | Done (above; test asserts the contract) |
| 6. DESIGN.md, sdk-integration.md, visual-evidence.json + helper, report.md | Done |
| 7. Fresh check, typing flow and agent test after the final source change | Done (132/132, 46/46, 50/50) |
| ET-1, ET-2 (+ LR-1/2, F1–F4) | Fixed with failing-before regressions; browser cases |
| Lead L-1: context lines split mid-word at 390/320 | Fixed in `932f000` (CSS only). 0 split words over 25 seeds at 390 and 320, against 17 and 13 on the old rule. Geometry, slot fit and `.missed` unchanged. States, typing flow (46/46), check (132/132), unsaved (74/74), zoom, agent (50/50), bundle and the visual receipt were rerun on the new build. |

## Limits and housekeeping

- Not covered: OS IME, screen readers and AT, Firefox/Safari, physical devices, human typing. Automation and accelerated clocks prove event plumbing, not experience.
- Receipt hashes cover the working-copy bytes at generation. With `core.autocrlf` a fresh checkout may rewrite text-file line endings, so recompute before comparing.
- `states.mjs` takes viewports as one comma-separated argument; space-separated arguments run only the first width.
- Scratch profiles left from interrupted earlier runs (`dp-impl-agent-E0XK6F`, `dp-impl-quick-0-sJKzFb`, `dp-impl-states-320-0-R69yxw`, `dp-impl-states-320-3-nbaELs`) are inside this worker's scratchpad. They were left in place, per the brief. The L-1 runs left no new profiles.
- The L-1 preview on 5301 (PID 37416) was stopped before the agent test, which started and stopped its own server on 5301. No background process remains.
