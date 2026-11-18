# F: actual-Claude baseline and personalized-practice integration (UI)

Worker task task_6b9f44e5772d, dispatch ctx_42f53856b629. This lane owns the app, UI and copy in
`typing-app/client`. Root keeps integration and final acceptance, and this report is not a self-approval.
Model actually exposed: **claude-opus-5-5**, effort **high**. No subagents or helper workers were used.

The accepted contract, as implemented against the real C (storage), D (policy) and E (finite engine) modules:
- The ten-test baseline is optional and unlocks personalized Suggested practice.
- General 30 s is immediately usable on `/`.
- There is no landing page, no forced onboarding and no new visual direction.
- No storage, policy, engine, types, corpus, model, package, lock or config file was changed.

## Commits (branch `OwenC05/tf-coach-ui`, not pushed)

| Commit | Summary |
| --- | --- |
| `6e86f6f` | feat(coach-ui): map actual prepared status to the accepted baseline copy |
| `3219d7f` | feat(coach-ui): focus view, plan-truthful why line and stale follow-up copy |
| `601a69a` | feat(app): integrate baseline, admitted Suggested and source-union recovery |
| `342099c` | fix(app): fresh-status ordinals, use-30 keeps Suggested, slot never clips keys |
| `0d071d6` | test(browser): real C/D/E flows, labelled injected statuses, port 5324 and currentResults |
| see `git log` | docs(ui): F implementation report, acceptance matrix and captures (this file) |

The docs commit hash is in the worker_done message, because a commit cannot name its own hash.

## What the integration does

**Status.** The app reads C's `preparePractice` status after first paint and never before the stage is usable.
- A preparation is single-flight, keyed by generation and abortable. Storage invalidation (C's
  `subscribeStorageInvalidation`, including other tabs) re-prepares only when no block is running.
- `coach-ui.ts` maps the actual `PreparedStatus` to copy. Counts and ordinals come only from D's proved
  participation. A lower bound is never shown as exact, and unavailable is never "0 of 10".

**Baseline.**
- A 30 s qwerty assessment counts when C supplies a capture and the status can still count it.
- The run freezes its identity once, at the first accepted insertion. The frozen identity is the label, baseline
  flag, test number, capture and pair.
- The save goes through C's `saveSource(source, capture)` with that frozen capture. The discriminated
  `Persistence` result drives the save row and the baseline block:
  - saved;
  - failed and retryable, which makes retry the focused primary for a baseline test;
  - failed and permanent, which hides retry and keeps export.

**Suggested.**
- A Suggested request runs only a plan that C/D admit (`admitPreparedPractice`). Admission happens before the
  first insertion, with the run state read after C's async barrier.
- The admitted snapshot is handed to E's `createFiniteAdapter`. A `RangeError` from the adapter, a refusal or a
  non-pilot setting gives an honest General block that says so. There is never a clamp or a mixed block.

**Recovery.** Unsaved completed sources (timed or finite) stay on the page with their original source and capture
(`unsaved.ts`). They can be retried, exported or discarded, and a page leave is held once while any remain.
The results page and Progress read the source union (`getSavedSource`, `listSavedSourcesPage`). A finite record
is shown as itself and is never cast to a timed result.

**Progress.** Progress shows the baseline count and summary from the status. Reset (`resetEpoch`) is reported
only after a proved re-read. Export uses C's `exportSavedSources`.

## Defects found by the real browser flows and fixed here (`342099c`)

1. **Stale ordinal.** Pressing Enter while the previous save was settling could freeze the previous status's
   ordinal into the new run. A run whose first key lands before its own status is prepared is now labelled
   "Baseline test" with no test number. C still decides whether it counts from the capture.
2. **use 30 s dropped Suggested.** At 60 s the view shows General because Suggested cannot run there, and
   [use 30 s] rewrote `practice=general`. It now carries the request, so the 30 s restart admits Suggested
   (D2a oracle).
3. **Locked fallback left the view on Suggested.** A Suggested request that falls back while locked kept
   "suggested" selected on a General block. The view now syncs to General.
4. **No-break space lost.** My label rewrite dropped the original no-break space in "30 s"; it is restored.
5. **Slot clipped keys at 320 px.** The fixed-height slot clipped the [use 30 s] key and the unsaved-recovery row.
   Before the first letter the slot now grows, and the recovery row replaces the ready hint until it resolves.
   Every capture now asserts that no slot key is clipped.

Each of fixes 1–3 has a new source test in `tests/app.test.ts`, and every fix has a real browser check.

## Copy delta for independent review (no catalogue or policy change)

Root's message `msg_2119dbb98d07` states the facts:
- The certified plans for he, in, le and th each have 12 prompts, and none omits its pair.
- The adapter consumes only that fixed sequence, and there is no General-mixing step.

The earlier accepted copy promised that general sentences would be mixed in. That would be untrue, so the why?
line is now `coachUi.suggestedPlanLine`: "Every sentence in this block contains th. It is one fixed set of
sentences, so it can end before the timer."

The real flow asserts the absence of "mixed in" (`screens/suggested-ready-why-*.png`). The finite end says
"That's every sentence in this th block, so it ended before the timer", and its label is
"Suggested practice · th · all 12 sentences done at T s of 30" (`screens/suggested-plan-end-*.png`).
This delta is recorded for a later independent Claude review; no plan, catalogue or policy was touched.

## Design point for review: admission is the linearization point

- Before the first key, a ready Suggested block follows the latest admission. An untouched ready block is
  re-installed when a later preparation admits a different plan. It is reverted to an honest General block,
  with a one-line reason, when a preparation no longer admits one (proved live: a reset in another tab).
- After the first accepted insertion, nothing changes the running block or its frozen identity. In-flight checks
  are aborted, and preparation resumes after the block.
- C reads `runState` after its async barrier, so a first key that races admission makes C refuse it (`started`).

## Old-test-to-new-invariant map (lease msg_2f1d0dd3484f)

| Old assertion | Why superseded | New explicit test |
| --- | --- | --- |
| Restart waits for fresh calibration and focus before enabling input | General used to wait on optional calibration and the old focus selector | `General restart never waits on optional evidence…` and `a chosen Suggested restart waits only for its own admission…` (admitted / refused / adapter-refused / disposed / not-pilot) |
| Evidence-backed recommendation parsing | `recommended` used to select a drill from local evidence | `practice query supports general, a Suggested request…`: `recommended` is a request only; admission decides |
| Direct recommended practice selects the old selector's drill | Same | `direct Suggested request builds ordinary General until admission…` |
| Results page coach selector | A focus used to be selected on the results page | Results test: no focus there; current record via `getSavedSource`; a finite case added |
| Save fakes `saveResult` / `ResultValidationError` | C's fenced save returns a discriminated `Persistence` and never throws validation | Save tests model `Persistence` (saved / failed retryable / failed permanent / throw→retryable); the VM fake never recovers success from `exists(id)` |
| ET-1 carried retry by id | Recovery must re-send the original source and capture | `continuation.test.ts`: the same payload and the same capture are re-sent; a throw stays failed and listed |
| ET-2 calibration on every restart | Predictions are once per sentence and optional | ET-2 extraction via `loadEvidence`: stale restart/dispose writes nothing; finite and qwerty-off skip calibration |
| (new) | — | `a run freezes its identity … exactly once`; `a run started before its status is fresh…`; `use 30 s keeps a Suggested request…`; `a locked Suggested fallback clears the request and the selected view together` |

Preserved unchanged, apart from extraction boundaries:
- ET-1 ordering, immutable source/capture, single-flight, stale settlement, rejected-once and export.
- ET-2 once-per-sentence prediction.
- Native input, deadline, keyboard, paint and parsers.
- Manual, retest and legacy behaviour.
- Nonempty extraction guards.

## Acceptance matrix

Legend:
- **real**: production build, real key presses, real C/D/E.
- **real-fault**: real C with an environmental fault (IndexedDB write or open patched in the isolated page).
- **injected**: C's real status passed through a named test-side patch. It proves presentation only, not lifecycle.
- **source**: Node tests.
- **not executed**: an explicit limit.

Oracle IDs reuse the prior UX acceptance scripts: `ux/evidence/scripts/regressions.mjs` (REG, 85),
`delta-regressions.mjs` (D/N, 60) and `keyboard.mjs` (K). Their prototype fixture states are mapped here to the
actual types. A prototype fixture port is never counted as lifecycle proof.

### Real flows: `real-flows.json`, 120/120 passed

| Oracle | Behaviour checked | Source |
| --- | --- | --- |
| K1, REG-3c | First visit: General 30 s, qwerty off, textarea focused, clean URL, Suggested locked after the check; first key starts | real |
| K2, K2b, K2c, K2d | Locked Suggested by pointer, arrow and Space: value kept, the slot explains with a take-test key | real |
| K3, REG-8b | why? opens with Enter: "0 of 10", "about five minutes of typing" | real |
| D2b, D2c | General at 60 s stays ordinary; a Suggested request with qwerty off (locked) is ordinary General | real |
| REG-3a, REG-3b | Assessment hint offers the qwerty declaration and the first key still starts; the not-counted result offers the same key | real |
| K9 | A letter on the result is not intercepted | real |
| K4, K4b, REG-5c | Test 1 completes in place, counted after save; Enter continues to test 2 | real |
| REG-5a (+ fix 1) | Rapid Enter while the save settles: no stale ordinal; test 3 once fresh | real |
| — | Real reload mid-baseline: the count is read back from storage | real |
| K5, REG-5g | Interrupted (focus left): not counted, count unchanged; "try test 4 again" | real |
| REG-6a, K6 | Save failed (IndexedDB `add` fault): retry saving is the focused visible primary, not counted; Enter retries, then 5 of 10 | real-fault, then real |
| REG-5d, REG-5f, REG-8b | Next test after a failed save: test 7, recovery row; why? names the unsaved test; retry from the slot succeeds, label stays 7 | real-fault, then real |
| REG-2a, K7 | Test 10: Baseline complete, "Last 10 tests · median", "Suggested has a focus: th" with numbers; try suggested is the primary | real |
| K9 | The keyboard-reached primary shows a visible focus indicator; under forced colours it keeps a real outline | real |
| K7 | try suggested → ready `Suggested practice · th · 30 s` on the admitted plan | real |
| copy delta | why? explains th from the admitted snapshot; no "mixed in" promise | real |
| REG-9, D2e | Finite plan ends at its last sentence (end marker, "all 12 sentences done at T s of 30", "over the T s typed"); never "30 s · complete"; saved as a finite source | real |
| — | Suggested again: the same plan, admitted afresh; timer first: an ordinary practice result | real |
| D2f | Flagged finite end (focus left mid-plan): the flag leads, no figures | real |
| D2a, D2d (+ fix 2) | Suggested at 60 s is General with an honest hint and no finite plan; [use 30 s] admits Suggested | real |
| REG-2b, REG-8a | Progress: 10 of 10 once, summary with dates and update note, finite rows | real |
| — | Export: C's envelope carries the original finite and timed sources | real |
| K10, REG-2f | Reset is safe-first (focus on keep); start over → "New baseline started: 0 of 10…" after a proved re-read; no median | real |
| D1a (+ fix 3) | Cross-tab reset before the first key: the ready Suggested block switches to honest General with its reason; reload names no previous pair | real |
| — | The results page reads the finite record from the source union | real |
| K8 | Even timing over ten tests: complete-insufficient, General is the primary | real |
| — | Stale evidence (clock +31 days): tests still count, only the timing needs refreshing | real |
| — | Isolation per world: only the UUID synthetic database exists | real |
| layout | Every capture at 1440 / 390 / 320: no horizontal overflow, no clipped slot key, no undefined/NaN/null; forced colours and reduced motion | real |
| — | No page or console errors; own server exited and port 5324 closed | real |

### Injected states: `injected-flows.json`, 61/61 passed

The dev-served `coach-storage` module is rewritten in flight by a test-side route. `preparePractice` returns C's
real status through one named patch, and each world asserts that the rewrite was applied. Each state is checked on
`/`, the assessment page and Progress, at three widths:

| State (actual type mapping) | Checked |
| --- | --- |
| `counted1`: participation in-progress, counted 1, ordinal 2 (REG/K "1 of 10") | status "1 of 10", slot "take test 2", assessment label "Baseline test 2 of 10", Progress 1 of 10 |
| `counted9`: in-progress, counted 9, ordinal 10 | the same with 9 / test 10 |
| `pending`: participation pending (lower bound 4), `pendingSave` 1 | "at least 4", no ordinal anywhere, never 0 of 10 (REG-4a, REG-4b, REG-8c) |
| `context`: participation unavailable `context-unavailable`, coaching unavailable | "couldn't be read… aren't being counted", no number, assessment label without an ordinal (N1b, D1e) |
| `completePending`: participation complete, summary and coach pending | Baseline complete, no focus claimed, "check again" |
| real-fault: `indexedDB.open` always throws (real C) | "saving isn't available here", never 0 of 10, General runs |

### Source tests

`npm run check` (`full-check.txt`): 229/229 tests, clean typecheck and production build. Coverage includes:
- `coach-ui.test.ts`: every reason in every coaching state (REG-1, REG-1b, REG-1c, N1a–c); lower bounds and
  ordinals; summary proof (REG-2c, REG-2d, REG-2e); change notes (D1b–d).
- `app.test.ts`, `continuation.test.ts`, `legacy.test.ts`, `unsaved.test.ts`: the map above.

Existing browser checks migrated to port 5324, `currentResults` and UUID synthetic databases:
- `typing-flow.js`: 49/49 passed, run unchanged through `coach-app.mjs` (`typing-flow.json`).
- `ui-sdk-agent.mjs`: 50/50 passed (`ui-sdk-agent.txt`).

### Not executed (limits)

- Real screen readers, physical OS IME, other engines, physical devices and browser UI zoom.
- Wall-clock durations. All timing uses Playwright's paused clock with scripted key intervals.
- **REG-5b and REG-5e.** Enter at an exact 200 ms during the save, and a delayed failure during an active run, are
  timing races. These are covered by source tests (single-flight, stale settlement) rather than reproduced live.
- **REG-6b.** A failed save of test 10 specifically was not reproduced; REG-6a exercises the same path at test 5.
- **REG-7, D1b, D1c.** A focus change between two different admitted pairs needs a second certified focus from
  real typing. D1b and D1c are covered by the coach-ui source test.
- **REG-2e.** Deleting a counted test has no UI in this lane; it is a source test only.
- **REG-1b.** The disabled-config state cannot occur with the shipped enabled config; it is a source test only.

## Finding for C/root (outside this lane; not changed)

`storage.ts` `openDatabase` runs `metadata.add(…)` inside `onupgradeneeded` without a try/catch. A synchronous
throw there (seen when a test patches `IDBObjectStore.prototype.add` before the database exists) escapes as an
uncaught page error. The upgrade still aborts and the save correctly reports a retryable failure. Only an injected
fault produced it, and in the app, preparation creates the database at load. `typing-flow.js` therefore injects
its fault after the database exists.

## Helpers and isolation

Receipts are in `*-helper-receipt.json`. Each phase spawned exactly one hidden server: Node `windowsHide: true`,
no shell, strict 127.0.0.1:5324. Each receipt records the PID, executable, arguments and closed port.

One interrupted run (stopped deliberately during harness debugging) left the harness (PID 19468) and its preview
(PID 74512). Both were verified by command line as my own `coach-app.mjs` and `vite preview … --port 5324`,
stopped, and port 5324 was confirmed closed.

Every browser context was fresh, with an init-script redirect to `typeforge-ui-synthetic-<uuid>`. The interception
was verified before storage use, and `indexedDB.databases()` was checked per world. No real user database,
Portfolio or original checkout, account, deployment, push or upload was touched.

## Reproduce

From `typing-app/client`, run `npm ci && npm run check`, then the phases in `tests/browser/README.md`.

---

## Addendum, 2026-11-18: admission follow-up (task_338af3c3e8c3, dispatch ctx_8769e62358cf)

**Scope and pins.** This continues from the delivered source `026cb69`: `app.ts` sha256 `0a847b20…`, `coach-ui.ts` `f5efb10a…`. The corrected source is `200ffcd`: `app.ts` `e3bcba2b…`, `coach-ui.ts` `fc259d68…`. The brief is `task-ui-admission-follow-up.md` at root `1c330d6`.

Only these leased F files changed:
- `src/app.ts`
- `src/coach-ui.ts` (one new copy constant)
- `tests/app.test.ts`
- `tests/browser/coach-app.mjs`
- `tests/browser/README.md`

There were no C/D/engine/types/catalogue/package/lock changes. Everything earlier in this report stands, including its limits.

**Runtime.** Requested: actual Claude, claude-opus-5-5, high effort. Exposed to this session: Claude Opus 5.5 (`claude-opus-5-5`); the effort setting is not exposed back to the model. No coordinator or global model setting was changed.

**Commits (not pushed):**
- `b920b6b`: regression evidence (red).
- `200ffcd`: minimal lifecycle correction plus source tests.
- (this commit): live scenarios, green receipts and this addendum.

### What was wrong (reproduced red in the real browser on `026cb69`)

1. **P1a, stale first key.** A storage invalidation made the status stale and queued a re-preparation. The first native key then still started the old admitted finite `th` block and froze its identity. Two triggers were reproduced: a reset committed through C (`resetEpoch`), and a bare window `focus` invalidation.
2. **P1b, awaited publication.**
   - `settleReadyBlock` awaited `finiteRuntime()`. After the import resumed, it checked only `disposed`/`untouched()`. So the older `th` snapshot installed after a reset and a newer generation that had already shown 0 of 10.
   - A Suggested restart awaited the runtime after admission, installed a snapshot taken before a reset, and never re-read the status.

### Correction (`200ffcd`)

**The rule.** An admitted snapshot is *current* only while the storage-invalidation epoch it was prepared in still holds. Each invalidation callback advances the epoch, including during a restart. There is no timer and no synthetic proof: only C's next real admission makes Suggested current again.

- **First key** (`acceptInput`). The rule applies to an idle, unfrozen finite block whose admission is no longer current. General is installed first, then the key is applied exactly once to it, so `freezeRun` freezes General. Focus is not moved. The slot says: "Suggested was re-checking your saved tests, so this block is general. It checks again for the next block." A current admission starts exactly as before.
- **Settle.** A stale snapshot never publishes. After the awaited import, generation and epoch are re-checked as well as untouched.
- **Restart.**
  - The runtime loads *before* admission, so nothing is awaited between C's admission and installation.
  - An admission that a storage change overtook is retried (at most 3 attempts) against the newer state. A still-stale one becomes honest General.
  - The status is re-read after the stage is ready whenever the read went stale.
  - Input stays held during the restart (unchanged), so no key lands in the gap.
- **Accepted tradeoff (bounded UX).** A focus/pageshow invalidation also stales the admission until C re-admits. That takes one `setTimeout(0)` plus a preparation, typically tens of milliseconds. A first key inside that window gets the General notice rather than Suggested. I chose this over relaxing the authority contract.

### Acceptance matrix (separated by evidence kind)

| Evidence | Receipt | Result |
|---|---|---|
| Real typing fixtures (`real`) | `admission-follow-up/fixtures-flows.json` | 5/5. A admits th; A+B admits in |
| Race, **red** on `026cb69` (`real-seeded`) | `race-red.json`, `race-red-source.json`, `screens-red/` | 35/39. Fails P1a/reset, P1a/focus, P1b settle/idle, P1b restart |
| Race, **green** on `200ffcd` (`real-seeded`) | `race-green.json`, `screens/race-*` | 39/39 |
| Live scenarios on `200ffcd` (`real-seeded`) | `live-flows.json` | 42/42 |
| Existing real flows on the rebuilt `200ffcd` production build (`real`) | `admission-follow-up/real-flows.json` | 120/120 (regression) |
| Source tests (`source`) | `npm run check` | 233/233, typecheck and build green |
| Injected statuses (`injected`) | earlier `injected-flows.json` | not re-run: presentation-only and unaffected |

`real-seeded` means a fresh UUID synthetic database, with saved sources produced by real typing in the fixtures phase. They are re-saved through C's own `captureContext` + `saveSource` (each returned `saved` with membership ready). Counts, membership, proof and admission are therefore C/D's real results. Nothing injects a status, admission or freshness.

**Live scenarios (all `real-seeded`, dev server, 1440/390/320 captures):**
- **Delayed save (REG-5a/5b).** Each save is held at C's source hash. Enter at 0 ms and at 200 ms moves to the next numbered test with focus in the text, nothing at risk shown and one held save. Release then saves exactly once.
- **Failure during the next block (REG-5e).** Test 7's save fails while test 8 runs. Test 8's label, prompt ids, text, state and focus are untouched. After test 8, "Test 7 isn't saved yet, so it doesn't count. retry saving" is offered.
- **Failed tenth save (REG-6b).**
  - Before retry: not counted, retry is primary, no completion or unlock, progress 9.
  - Retry saves once. "Baseline complete." and "Suggested has a focus: th" each appear once, and "try suggested · th" is focused.
  - Progress shows 10 of 10 once.
- **Focus change between two admitted pairs (D1b/D1c).**
  - Ten in-slow practice sources are saved through C during a running th block. Its label and prompt plan stay frozen, and the result is labelled th.
  - The next Suggested block runs the newly admitted in plan and says once that it moved from th. The block after names no previous pair, and so does a reload.
- **Deletion.** The existing results-page **Delete** control (`#delete-result` → confirm → `deleteResult` → C `deleteSource`) removes a counted test.
  - Progress shows 9 of 10 and no median.
  - The already open ready Suggested tab steps back to General through the real storage invalidation, with status "Not yet available: 9 of 10 baseline tests."
  - No new deletion UI was built.

### Observations and limits added

- When the baseline drops below ten, the stepped-back slot reuses the accepted locked-fallback copy ("Suggested has no focus for now…"), while the status line states the actual reason (9 of 10). This is earlier accepted F UX, left unchanged and flagged for copy review.
- Race and live use the dev server, because the delayed import is a route hold on `/src/finite-practice.ts`. The production bundle was covered by the 120-check real regression, not by the race holds.
- A harness overshoot (keys typed past test 8's deadline onto the result action) was found while building REG-5e and fixed in the harness. It was not a product defect.
- Root's VM observed-defect assertions were not copied. The new source tests assert the corrected invariants.
- The separate C-lane storage callback exceptions (upgrade/delete/read faults) were neither duplicated nor touched.
- There is no C/D interface gap: `admitPreparedPractice` and `subscribeStorageInvalidation` were sufficient.

### Helpers

- Every phase spawned exactly one hidden server: Node `windowsHide: true`, `shell: false`, strict 127.0.0.1:5324.
- Receipts: `fixtures`, `race-red`, `race-green`, `live` and `real` `*-helper-receipt.json`, each with `serverExited: true, portClosed: true`.
- Afterwards there was no listener on 5324 and no `vite.js … 5324` process; only kernel TIME_WAIT sockets (owner PID 0) remained.
- Root 5301 and reviewer 5325 were not used.
- No real user database, Portfolio/original checkout, account, deployment, push or upload was touched.

**Reproduce:** from `typing-app/client`, run `npm run check`, then `COACH_PHASE=fixtures`, `race` and `live` (dev server) and `real` (after build), as in `tests/browser/README.md`.

---

## Addendum, 2026-11-18: General fallback prompt identity (task_01ea3afaaab7, dispatch ctx_5609eadd4661)

**Scope and pins.** This continues from `c7f85d1` (`app.ts` sha256 `e3bcba2b…`). The corrected source is `62e534a` (`app.ts` `e2a99c7a…`). Root's brief is `task-ui-fallback-prompts.md` at `f2c77b9`, with root's diagnostic `root-integration/fallback-prompts-probe.mjs`; that diagnostic is untouched and remains a historical observation.

Changed files, all leased F:
- `src/app.ts`
- `tests/app.test.ts`
- `tests/browser/coach-app.mjs`
- `tests/browser/README.md`

There were no C/D/engine/types/catalogue/package changes. Earlier addenda and limits stand.

**Runtime.** Claude Opus 5.5 (`claude-opus-5-5`); the effort setting is not exposed to the model. No global settings were changed.

**Commits (not pushed):**
- `c57b732`: red evidence.
- `62e534a`: fix plus actual-engine regression.
- (this commit): green evidence and this addendum.

**Defect (P2, confirmed red in the browser on `c7f85d1`).** Both General fallbacks, the settle step-back and the new first-key fallback, called `installBlock(makeEngine(qwerty.checked), null)`. The order of operations was:
1. `makeEngine` ran first, and `TypingEngine` copied the still-current Suggested `prompts`.
2. Only after that did `installBlock` choose General prompts.

The result, on both paths: the block was labelled "General practice", and `dataset.promptIds` listed General prompts, but the engine painted and persisted th-plan `practice-002` ("we take the short path beside the river"). See `fallback-red.json`: 14/19, with all 5 identity checks failing.

**Correction (`62e534a`).**
- `installBlock(block | null, snapshot)` now chooses prompts first, exactly once, and builds the General engine from them when no finite block is given. This is the order restart already used.
- Both fallbacks call `installBlock(null, null)`.
- Suggested installation (`installBlock(finiteBlock, snapshot)`) is unchanged.
- There is no second randomization and no label- or metadata-only repair.

**Regression.**
- **Source (`tests/app.test.ts`).** Runs the actual `makeEngine`/`installBlock` source slices with the real `TypingEngine`, the certified th plan and the real General selector. It checks:
  - one selection;
  - the engine runs prompt 0 and then prompt 1 of the shown General sequence;
  - `submittedSummaries` ids equal the shown ids;
  - the first character is accepted once;
  - a Suggested install keeps its finite block and the plan prompts.
  It also asserts that both call sites build General inside `installBlock`. It is red against `c7f85d1`'s `app.ts`, verified by temporarily swapping the file and restoring it byte-identical, and green on `62e534a`.
- **Browser (`COACH_PHASE=fallback`, `real-seeded`, strict 5324).** Covers both paths. Identity is the *sequence*, because General legitimately shares bank prompts with the th plan:
  - the painted passage is the first listed General prompt;
  - the persisted sentence ids equal the listed General prefix and differ from the th sequence;
  - the first key `t` is recorded once as `sentences[0].response`;
  - the record is `mode: practice` and the result reads "General practice · 30 s · complete".

| Evidence | Receipt | Result |
|---|---|---|
| Fallback, **red** on `c7f85d1` | `fallback-prompts-follow-up/fallback-red.json`, `fallback-red-source.json`, `screens-red/` | 14/19 |
| Fallback, **green** on `62e534a` | `fallback-green.json`, `screens/fallback-*` | 19/19 |
| Affected race (first-key fallback) on `62e534a` | `race-flows.json` | 39/39 |
| Affected live (deletion step-back etc.) on `62e534a` | `live-flows.json` | 42/42 |
| Production real flows on the rebuilt `62e534a` | `real-flows.json` | 120/120 |
| Source | `npm run check` | 234/234, typecheck and build green |

**Limits.**
- The fallback, race and live phases run on the dev server, because the seeding and import holds need unbundled source. The production build was covered by re-running the 120-check `real` phase on `62e534a` (`real-flows.json`, 120/120), not by the fallback assertions.
- The fixtures were copied from `admission-follow-up/fixtures/` (real typing, synthetic).

**Helpers.**
- Five hidden servers ran (Node `windowsHide: true`, `shell: false`, strict 127.0.0.1:5324), each with `serverExited`/`portClosed` receipts.
- Afterwards there was no 5324 listener and no `vite.js … 5324` process.
- Root 5301 and reviewer 5326 were not used.
- No user data, Portfolio/original checkout, push or deployment was touched.
