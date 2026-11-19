# B1 / A1: available-browser and accessibility evidence

16 November 2026. P4, task `task_08e5d0d508f0`, dispatch `ctx_8e8d2efe1568`.
Application source unchanged from accepted `b3fb14c`; checked HEAD
`c65460b91ab2b310cb51f2f8cd4247d6c9f7c482` adds planning records.
`git diff b3fb14c -- typing-app/client/src typing-app/client/package.json typing-app/client/package-lock.json`
was empty. No production, package or lock changes were made.

## Scope and result

Chrome **157.0.8103.52** and Edge **157.0.4341.60** each passed **72 assertions**:
46 existing native regression assertions, 15 focused browser/semantic checks and
11 narrow-screen/recovery checks. These are **two browser products using Chromium**,
not independent rendering engines. No page errors were recorded by the native suite
or focused desktop probe. Source tests: **132 passed, 0 failed**. Production
typecheck/build passed using Node **24.21.0**, Vite **8.3.1** and the locked dependencies.

No native input/persistence blocker was reproduced in those bounded cases. Actual
Claude subsequently identified forced-color selected-state loss in the captured
ready state (F-1 below). This result is not whole-product accessibility or
cross-engine acceptance. Safari/WebKit, Firefox,
physical mobile devices, physical OS IME and real screen-reader speech remain gaps.

## Reproduction and resource ownership

Run from the worktree root; use an existing Playwright installation, without adding
an app dependency. `P4_PLAYWRIGHT` can override its absolute module directory.
The observed installation was `C:/Users/Owenc/.codex/tools/mcp-node/node_modules/playwright`,
version `1.64.0-alpha-1790635538000`. The existing repository's browser README explicitly
uses Playwright for native event regressions. No user browser profile was opened.

1. In `typing-app/client`, `npm ci --ignore-scripts`, then `npm run build`.
2. Start `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5314 --strictPort`
   in that client directory. The owned hidden preview was PID **14920**;
   its command identity and cleanup are recorded in `preview-process.json` and `cleanup.txt`.
3. At root, `node docs/implementation/2026-11-16/baseline/release/browser-check.cjs`.
4. At root, `node docs/implementation/2026-11-16/baseline/release/accessibility-check.cjs`.
5. In the client, `npm test`. Both verification scripts also passed `node --check`.

For the actual-Claude follow-up, a second owned hidden preview used PID **8760** on
the same strict port after the first was stopped. `forced-colors-capture.cjs`
captured native typed-prefix/mismatch, focused Restart, and unfocused cover states,
then closed each context/browser. Its command, cleanup and exact state receipts
are `forced-preview-process.json`, `cleanup.txt` and `forced-colors-evidence.json`.
This capture and its `node --check` exited zero. It adds observations, not counted
passing visual assertions, to the 72-per-product functional/semantic total.

All final commands exited zero. Each browser launch used headless Playwright's
temporary profile and isolated contexts, closed in the runner. Each existing suite
case creates and closes a separate context/database. Only generated keystrokes,
application corpus text and generated results were used. No real history was loaded.
Preview port 5301, Portfolio, the original checkout and global configuration were untouched.
No timing benchmark was attempted. Deadline tests use the accelerated Playwright clock.

`browser-evidence.json` records the exact source/lock SHA-256 hashes and built asset
filenames and hashes, plus browser versions, user agents, individual results and media
values. `build.log`, `tests.log`, browser/accessibility JSON and ARIA snapshots provide
the underlying evidence. The helper browser processes were closed by their own
Playwright browser handles; no shared browser process was terminated.

## B1 observed cases

| Case | Observation in both Chrome and Edge |
|---|---|
| Clean `/` | General practice, 30 seconds, native textarea focused; first accepted `a` starts the block; no landing gate or URL query required. |
| Native correction | Wrong first character exposes correction hint; Home + Shift/Right selects the character and mirrors the selection; replacement clears the hint. |
| Native middle edit | Type `abcde`; Home, Right, Shift/Right selects `b`; native `x` produces `axcde`; Backspace produces `acde`, preserving the suffix. |
| Passage advance | Enter neither inserts text nor advances; terminal Space rolls the passage and retains native focus. |
| Result / Again | Accelerated 30-second General completion saves exactly once, focuses Again; Enter returns to a new ready block with empty textarea focused. |
| Durations | 15/30/60/120 URL settings and idle timers match; changes are refused after native input; 15-second result keeps duration/elapsed and does not duplicate after later ticks. |
| Settings persistence | Keyboard Space selects 60 seconds and toggles QWERTY; clean `/` navigation retains both; keyboard manual-pair choice and selected `ti` persist. |
| Safety-stop recovery | 600 native characters accepted, 601st safely stopped without overwriting; no progress result saved; keyboard reaches Restart/diagnostic Export and restart restores native focus. |
| Transient save failure | Context-local `IDBObjectStore.add` quota error leaves readable/exportable result; restoring the method and Retry saves once. Patch is restored before context close. |
| Blocked preferences | Context-local `localStorage` getter throws SecurityError; clean first-key General still starts. |
| Invalid legacy query | Unsupported duration and manual-pair fallback remain explained. |

## A1 evidence inventory

| Evidence | Observed bounds |
|---|---|
| Names and roles | Ready snapshots expose one named textbox `Type the passage`, duration/practice radiogroups with checked radios, disabled suggested radio, named QWERTY switch, named navigation, timer, status and main/heading landmarks. |
| Text alternatives | Textarea has a native `<label>` and `aria-describedby="target-description typing-help"`; current passage and editing instructions are programmatically present. Painted prompt is hidden from the accessibility tree to avoid duplicate passage content. |
| Manual pair | Keyboard opens named `Pair` combobox/listbox with named options; ArrowDown + Enter chooses a pair and persists it. Snapshots saved while expanded. |
| Desktop focus | Tab trace reaches Restart, skip link, brand/navigation, selected duration/practice radio, QWERTY, why, start-typing and native textarea. Running input Tab reaches Restart. Restart/Again return focus as above. |
| Narrow keyboard | At 390 x 844 CSS pixels, menu is named, opens/closes with Enter, and Tab enters its practice link; why disclosure opens/closes without stealing focus. This is desktop viewport emulation, not a physical phone. |
| Focus recovery | Blur native input to neutral focus, then Enter restores it. Active why disclosure retains its own focus. |
| Skip link | Enter sets `#main`; the next Tab reaches the selected 30-second radio inside main, bypassing header navigation. |
| Reduced motion | Emulated `prefers-reduced-motion: reduce` matches; computed topbar transition duration is `0s` and animation is `none`. |
| Forced colors | Emulated `forced-colors: active` matches; textarea remains focusable with `forced-color-adjust:auto`; keyboard-focused Restart has a solid 2px system-colored outline. Screenshot artifacts are observations for actual-Claude review, not P4 visual approval. |
| AT limit | DOM/ARIA snapshots do not establish spoken announcements, reading order in an actual screen reader, dictation or physical IME behavior. Those were not exercised. |

The first supplemental probe asserted that the fragment skip link must make main
the `activeElement`. It returned body in both browsers. A focused follow-up showed
the next Tab correctly starts inside main. `accessibility-first-probe.json/.log`
retain that false assertion; the final runner tests navigation bypass instead.
No product defect is claimed from the first harness assumption, and real AT
landmark announcement remains unverified.

The textarea deliberately suppresses its native outline/caret and uses the painted
prompt. Forced-color computed styles changed native text/caret to system black.
This alone cannot establish legibility or custom-caret visibility. The two
`*-forced-colors.png` files were routed to actual Claude via `ctx_188d78feb5e3`
(message `msg_22817cb75c8e`), with root copied (`msg_be76b3b3d459`). Any visual or
interaction-design change belongs to that lane and requires its actual review.

### F-1: forced-color checked setting state disappears

**Confirmed existing defect; medium release priority.** Actual Claude's initial
bounded image verdict is message `msg_ad656d2e84ee`. Ready screenshots show selected
duration/practice and checked QWERTY keys without a persistent selected-state cue.
Claude reports that the native caret, dashed locked-suggested edge, key edges,
rules and topbar current underline survive in that state.

Reproduction: enable forced colors in a fresh context, select 60 seconds and toggle
QWERTY with keyboard Space. `forced-colors-evidence.json` shows checked `60` and
unchecked `15/30/120` all resolve to black text, white background, 1px black border,
no text decoration. The checked QWERTY switch resolves to the same styles. Checked
roles/state persist programmatically; this finding concerns visible state loss.

Repair task owner: **actual Claude UI owner, coordinated by root**. Affected source:
`typing-app/client/src/style.css` checked selectors near lines 64-65; native setting
semantics are in `src/app.ts` near lines 198-216. Use a narrow forced-color treatment
that retains checked-state distinction (Claude proposed system Highlight/HighlightText
or a persistent border/underline cue). Acceptance: actual-Claude review of checked
and unchecked duration/practice/switch states under forced colors; retain keyboard
Space/arrow operation, focus outline, disabled suggested appearance and remembered
settings; rerun native-input tests without metric/source changes. No repair was made
by P4. Root received reproduction in `msg_416e93c4df8f`.

### F-2: typed passage distinction collapses under forced colors

Claude initially inferred from construction that typed/untyped luminance distinction
and the mismatch glyph's colored box may collapse in forced colors, without claiming
the ready images demonstrated it. Native typed prefix plus one
mismatch, focused Restart and unfocused cover images were therefore captured for
both browsers (`*-forced-typed.png`, `*-forced-key-focus.png`, `*-forced-cover.png`),
with exact text/styles/focus in `forced-colors-evidence.json`. Follow-up request:
`msg_60b93ae22f22`. Actual Claude's follow-up `msg_c635e69c7f71` **confirmed F-2,
moderate severity, in the Chrome captures**: typed prefix `we tax` and remaining
text use the same CanvasText, so typed progress is not visually distinguished.
The caret still gives position. Claude did not inspect the Edge follow-up pixels;
Edge has matching programmatic inventory and screenshots, not an independent
visual verdict for F-2.

The same Chrome follow-up passed the mismatch wavy underline, keyboard-focused
Restart ring and unfocused continue-typing cover/integrity rule. The expected-glyph
tag remains a legible bold glyph with lost box/salience (minor); it is not a lost
correction message. No AT or multiple physical Windows contrast themes were tested.

Repair task owner: **actual Claude UI owner through root**, narrow `src/style.css`
typed/untyped rules near lines 139-142. Acceptance: Claude verifies visible progress
distinction and retained mismatch/expected-glyph legibility in forced colors; avoid
font-weight/geometry changes that desynchronize native textarea selection, then
repeat native correction/selection/advance and focus checks. Root's
`msg_818679e94aea` separately assigns the F-1 repair to P2; both findings remain
open in this evidence snapshot until a repair commit and targeted independent
verification are supplied. That follow-up does not extend this initial P4 task
into production edits or repeat the entire audit.

## Ranked bounded follow-ups

1. **Release coverage gap, medium priority:** obtain an already-provisioned Firefox
   and Safari/WebKit environment. Owner: release verification. Affected files:
   release evidence/runners only initially. Acceptance: same first-key, middle-edit,
   Again, persistence and failure-recovery cases with engine/version/build hashes;
   no success claim for an engine that could not run. Current default Playwright
   Chromium/Firefox/WebKit executable paths are absent; installed Chrome/Edge were
   used through explicit channels. No browsers were installed.
2. **Accessibility validation gap, medium priority:** test real screen-reader speech
   and physical OS IME with generated data. Owner: accessibility/input QA, with actual
   Claude for UX judgments. Affected files initially: release evidence; production
   `src/app.ts`/`src/style.css` only if a defect is reproduced and assigned. Acceptance:
   record actual AT/OS/browser versions, label/passage announcement, typing feedback,
   completion/Again focus and recoverable save failure; verify composing input does
   not advance a passage or manufacture tracked timing.
3. **Forced-color defects F-1/F-2, medium priority:** actual Claude owns narrow checked
   setting and typed-progress state repairs as specified above; F-2 is confirmed
   in Chrome captures, with Edge follow-up pixel review still limited. No cosmetic
   changes were made by P4.

These are existing acceptance limitations from the baseline, narrowed by new
evidence, rather than newly introduced regressions. S1 dependency ranking and
repair tasks are recorded separately under `s1/`.
