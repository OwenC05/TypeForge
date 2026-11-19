# Engineering review — 15 November 2026

The current app has a solid, bounded typing engine and unusually careful result integrity, but its normal Windows verification command fails and native Undo discards assessment eligibility. The isolated production-browser regression passes all 39 assertions. Before adding a larger daily-practice feature, repair cross-platform verification, define normal editing eligibility, and address measured work in the input/render path on constrained CPUs.

This is an independent engineering/test review, not a design verdict or release certification. Application source, committed tests, dependency files and deployment were read-only. Other lane reports were not consulted. No application fixes were made.

## Scope and evidence identity

- Source: `de69444a6201da96281ca9ad88088904477775a2`, `feature/daily-practice`, native Windows PowerShell; Node **24.21.0**, npm **11.19.0**. Tracked source/tests remained unchanged. `git ls-files --eol` reports LF in the index and CRLF in the working copy; `core.autocrlf=true`.
- At final verification HEAD had advanced concurrently to `b9a2fb97599198506c6123c7aa8f1736149bccf0`; the reviewed application/source/tests/dependency/build-config paths are identical to the review base, and captured source/test hashes still match. See [source-stability.json](engineering-evidence/source-stability.json). This reviewer did not commit or inspect other lanes' report contents.
- Owned build: `typing-app/client/dist`; strict production preview **127.0.0.1:5188**, launched hidden as Node PID **46712**. No use of design's 5187 server or shared browser. Every browser case creates and finally closes its own context.
- Finished by verifying PID/command identity and stopping only the owned preview; [cleanup receipt](engineering-evidence/cleanup.txt) and [final verification](engineering-evidence/final-verification.json) record closure and zero tracked application diff. No listener remained on 5188 in that cleanup check.
- Browser: Chromium **157.0.8103.52**. Committed regression contexts use the verified default **1280×720** viewport; added mechanics use **1440×900** and **390×844**. Performance uses **1440×900**.
- Requested dispatch: **Codex / gpt-6.1-sol / high**, confirmed as the launch request in [dispatch-receipt.json](engineering-evidence/dispatch-receipt.json). This is a `ready` dispatch receipt, not an independent backend response receipt. The executing assistant is Codex; actual backend model and effective effort were not independently exposed by the review tools. No claim is made that requested settings were honored merely because configuration or dispatch fields exist.
- Loaded the installed Orca orchestration guide, code-reviewer/test-engineer prompts, and Ponytail guidance. Historical TypeForge memory concerned Windows/WSL setup only; current checkout, commands and handoff govern this review.

## Fresh verification

| Check | Result | Evidence and interpretation |
| --- | --- | --- |
| `npm run check` in client | **FAIL**, exit 1: **94 passed / 3 failed / 97 total** | [Full output](engineering-evidence/check-output.txt). The chained build does not run after failing tests. Three restart tests fail while parsing extracted source, before their assertions. |
| Separate `npm run build` | **PASS**, exit 0 | [Full output](engineering-evidence/build-output.txt): TypeScript and Vite production build pass. Vite emits a plugin-timing warning; PowerShell renders stderr as `NativeCommandError`, but the process exits 0. |
| Lint | **Not configured** | `package.json:9` defines no lint script. No lint pass is claimed. |
| Committed native browser regression | **39/39 PASS**, zero page errors | [Results](engineering-evidence/browser-regression.json), [port-only adapted script](engineering-evidence/typing-flow-5188.js). Read committed README first; its 5183 base was changed only to owned 5188. No app/test dependency installation. |
| Added mechanics | Completed, zero page errors | [Runner](engineering-evidence/extended-checks.js), [results](engineering-evidence/extended-results.json), isolated Undo evidence below. These are observations, not another numbered universal conformance suite. |
| Production read-only smoke | HTTP 200; rolling textarea/durations present | [Live request/DOM record](engineering-evidence/live-inspection.json). No typing result was saved or uploaded to production. |

Browser regression covers native 600+1-character stop, stopped keyboard navigation/export/restart, selection replacement, correction hints, Enter no-op, Space passage transition/focus, four durations, exactly-once expiry save, transient quota fault/export/retry and legacy fallbacks. Deadlines use an **accelerated Playwright clock**. It does not prove real-clock accuracy, operating-system input, screen readers or other engines.

## Findings ranked by user impact

### E1 — HIGH: normal Windows checks fail because restart tests assume LF source

**Proven local defect; high confidence.** `typing-app/client/tests/app.test.ts:37`, `:80`, `:350` look for `\n  prepare();\n  const initialEngine` inside text read directly from `src/app.ts`. The CRLF working copy does not contain that exact sequence. `end=-1` causes the extracted handler to include following source and fail with `ERR_INVALID_TYPESCRIPT_SYNTAX: Expected ',', got ';'`.

**Reproduce:** on this ordinary Windows checkout, run `npm run check` in client. Failing cases are restart calibration/focus, restarted retest origin re-resolution, and assessment-from lineage. [Diagnostic](engineering-evidence/line-ending-diagnostic.txt) records **809 CRLFs**, raw extraction end **−1**, and successful parsing after diagnostic-only CRLF normalization. This diagnostic neither executes repaired tests nor modifies source. A successful production build and browser Restart show that this failure is not evidence of a broken application parser.

**Impact:** contributors cannot obtain a green advertised verification command; these important race/lineage assertions are not executing locally. `.github/workflows/check.yml:7` runs Ubuntu only, so Linux CI can miss this Windows defect; current remote CI status was not queried.

**Recommendation / acceptance:** make source extraction line-ending independent and assert valid start/end boundaries before evaluating it. Keep the tests meaningful; do not disable them. Require all **97 tests**, typecheck and build to pass from LF and CRLF working copies, and retain native browser restart/lineage coverage. Prefer testing actual exported behavior as future code naturally separates; no new framework is needed for this repair.

### E2 — MEDIUM: ordinary native Undo makes the whole run unsupported and removes accuracy

**Observed behavior / product correctness limitation; high confidence.** In a new 15-second assessment, type `abc`, press **Ctrl+Z**, then let the timer finish without blurring. The value becomes `ab`; the browser emits `historyUndo`; the saved result has **`qualityFlags: ['invalid-input']`, `accuracy: null`, `eligibleForProgress: false`**. [Exact result](engineering-evidence/native-undo.json), [screenshot](engineering-evidence/native-undo-result.png). A separate case verifies word deletion, Undo, Redo, replacement and Backspace retain editable text, so the problem is eligibility/diagnostic loss, not missing native editing.

**Cause:** `src/app.ts:127` reconstructs explicit insert/delete edits, but `historyUndo`/`historyRedo` fall through to `tracked:false` at `:148`; `:377` passes this to the engine. `src/engine.ts:260` and `:298` disable diagnostics for the run, and `:466` excludes any flagged run from progress.

**Impact:** a familiar correction shortcut unexpectedly removes attempt accuracy and the headline result. This is currently conservative evidence handling, not proof of dishonest scoring. Preserving timing integrity remains valuable.

**Recommendation / acceptance:** decide and document native Undo/Redo semantics, then cover real browser undo/redo for insertion, selection replacement, word deletion and passage boundaries. Normal local corrections should preserve meaningful score feedback; exclude untrustworthy timing observations separately where necessary. Never restore timing eligibility by fabricating key timestamps. If whole-run exclusion is retained deliberately, state that specific consequence before use and test it explicitly.

### E3 — MEDIUM: CPU-throttled input rendering regularly exceeds a frame budget

**Observed constrained-browser performance concern; high confidence for this harness, limited device generality.** [Paired measurements](engineering-evidence/performance-paired.json) use fresh contexts in **1× / 4× / 1× CPU** order, five warm-up characters then **80 native `x` edits**, requested 20 ms delay, real unmocked clock. The interval from an input capture listener to a bubble listener after the app handler measures synchronous handler work; requestAnimationFrame measures scheduling to the next callback, not physical display latency.

| CPU rate | Handler median / p95 / maximum | Next-frame proxy median / p95 |
| --- | --- | --- |
| 1× first | 2.3 / 4.9 / 8.3 ms | 4.7 / 26.0 ms |
| 4× | 36.2 / 71.3 / 88.1 ms | 40.6 / 76.8 ms |
| 1× repeat | 2.4 / 5.0 / 13.4 ms | 4.2 / 17.0 ms |

The measured interval records no long tasks in either 1× run; the 4× interval records repeated long tasks. Earlier complete-passage measurements also showed constrained-CPU costs, but used different random passages; the paired fixed-input sample is the cleaner comparison. Neither is production-scale evidence, a phone benchmark, a physical typing-rate claim or a failure-rate estimate. CDP throttling is a simulated resource constraint on a shared host.

**Likely contributing source, not a proven profile attribution:** `src/app.ts:233` paints during keydown, beforeinput, input, keyup and the 100 ms timer. `:247` rebuilds all per-character spans on value/selection changes; `:268` reads layout and writes scroll. `:239`–`:242` also rewrite metrics on those paths. No dropped characters were observed in the bounded sample.

**Recommendation / acceptance:** profile and reduce duplicate paints/layout work before adding daily-practice UI into the hot path. Preserve immediate native input and deadline-first engine edits. Re-run this identical harness plus correct passage transitions and long-response cases; agree a named lower-resource target and require no lost edits, bounded handler p95 and no recurring input-attributable long tasks there. A 16 ms handler target is a useful proposed budget, not a claim that current or all devices meet it.

### E4 — MEDIUM: progress loads and renders unbounded lifetime history

**Source risk, not a reproduced large-history outage; high confidence in code path, unknown practical threshold.** `src/storage.ts:283` calls `getAll`, validates every saved record and sorts all results; `src/app.ts:665` waits for it, and `:683` creates a row for every result. Full-history export at `:698` also serializes the entire collection. The 1 MiB **per-result** bound does not bound lifetime memory, DOM or main-thread work. Existing pagination at `storage.ts:294` is used by calibration, not this page.

**Impact:** the intended returning daily user accumulates the exact data that makes history loading/export increasingly expensive. No arbitrary session-count failure or latency is claimed; large persisted histories were not benchmarked here.

**Recommendation / acceptance:** reuse the existing compound-index pagination for the visible history instead of introducing a dependency. Preserve exact newest-first ordering/ties and compatible-bucket summaries. Add representative large-history fixtures, measure first-page readiness on the agreed constrained target, bound visible rows and peak data held during export, and verify later pages/delete/export still cover every valid record.

### E5 — LOW: corrupt records are retained but ordinary export cannot recover them

**Observed recovery limitation plus source evidence; high confidence.** An isolated database-v1 fixture containing one real valid result and one invalid row upgrades to database version 2 with `completedAt-id`, shows one valid history row and a visible corruption notice. Export-history is available, and cancel/confirm deletion respectively retain/remove the valid result. The invalid row remains after deletion, outside normal history controls. See [extended results](engineering-evidence/extended-results.json).

`src/storage.ts:288` drops invalid records from the returned list; `src/app.ts:698` exports only that validated list. The notice at `:73` says invalid records are retained and encourages export before clearing browser data, but the ordinary export cannot include their raw contents. There is no user-facing raw quarantine export or selective corrupt-row deletion. Keeping invalid data out of calibration is correct.

**Recommendation / acceptance:** explain that normal export covers readable valid results only. If recovery is offered, provide an explicit local raw diagnostic export and selective cleanup that never feeds quarantined data into metrics/model evidence. Test mixed, entirely corrupt and unindexable histories without silently clearing records. This is recovery polish, not a reason to relax validation.

### E6 — LOW: deployment-status documentation lags current public app evidence

**Observed documentation mismatch; high confidence for assets, unknown deployment commit.** `README.md:38` says rolling flow is only a local implementation and the public smoke covers September. At **15:47 UTC on 15 November**, read-only production `practice.html` exposes four durations and the rolling textarea. Its downloaded JS and CSS are byte-identical to this review's production build: [SHA256 comparison](engineering-evidence/live-local-asset-hashes.json).

- JS `app-DRnCp6G3.js`: **EB6FEAAF4EB1B66FD23B4864BDF1CD64ED0EB6B3E39848C535CDB20488E94942**.
- CSS `app-CiIXzPbM.css`: **39485FB91C515A2AB4B178722B19C7C81EEBACCDEFDC9D3C6CF97509DCEC5D34**.

This proves parity of those two assets at observation time, not the production Git commit, all routes, all HTML, all assets or platform certification. The live favicon asset name differs from the local build. No production typing/save/delete test was performed.

**Recommendation / acceptance:** add a dated production receipt with deployment commit/build identity and supported-route smoke, while preserving untested platform gates and dated historical evidence. Do not claim full production parity from matching bundle names alone.

## Strengths worth preserving

- **Explicit session boundaries:** pure monotonic-clock engine, deadline-first rejection, defensive result snapshots, separate stopped diagnostic versus completed result, and fixed duration scoring. Fresh capacity tests retain the documented normal envelopes and stop over-limit results safely. There is no evidence from this review that the ordinary supported run exceeds its storage cap.
- **Native editing remains usable:** real selection replacement, word deletion, Backspace, Enter suppression, terminal-Space transition and focus recovery work in tested Chromium. At **390×844**, after 180 native characters, Ctrl+Home and Ctrl+End put the mirror caret inside the exercise scroll viewport; no document horizontal overflow was measured. This is geometry evidence, not a design judgment or a mobile-device certificate.
- **Storage failure is recoverable:** committed regression proves transient quota-style rejection leaves readable/exportable results and retries exactly once after recovery. Permanent validation errors are distinguished in source/tests. Added offline checking saves one 15,000 ms result after the loaded app loses network; offline page reload remains unsupported.
- **Migration/integrity:** non-destructive v1-to-v2 index creation, visible corrupt-row skipping, strict shape/version/size validation and explicit model/setting compatibility protect history. Fresh tests cover duration, flow/legacy isolation, lineage, immutable prediction evidence and model parity fixtures. Actual historical legacy-record fixture migration across multiple browser versions remains unverified.
- **Factual accessibility mechanics:** labelled native textarea with passage/help descriptions, hidden visual mirror, keyboard-operable buttons, skip link, named elapsed progress and status regions. Stopped textarea stays read-only while Tab/Shift+Tab, selection, export and restart remain accessible to native keyboard automation. No keyboard trap was found in those cases.
- **Small deployment surface:** no runtime frontend dependency, server API, remote font or inference request in the app source. Vite build emits **103.37 kB JS / 36.16 kB gzip** and **10.56 kB CSS / 3.14 kB gzip** shared across pages. Model and benchmark JSON are eagerly bundled (`app.ts:10`), so even the home page loads the shared evidence payload; the present total is modest and does not alone justify splitting it.
- **Privacy boundary:** inspected production load sends only same-origin HTML/JS/CSS/favicon GETs; no typing/history egress call was found in reviewed application code. Typed responses and aggregate diagnostics live in origin-scoped IndexedDB; JSON export is a local download. Hosting still receives ordinary request metadata. This is a bounded source/network observation, not a guarantee about hosting logs or browser extensions.

## Test gaps and next engineering sequence

1. Repair **E1** first; retain its Windows/LF evidence as a regression. `npm run check` must execute all restart assertions, not merely compile production code.
2. Add explicit browser cases for **Undo/Redo**, repeated keydown, trusted paste/drop prevention, composition reconciling at both event orders, real-clock expiry after blocking/backgrounding, and restart with changed/deleted origins. Existing engine tests are useful but source-sliced VM tests do not establish actual DOM/browser behavior.
3. Make the committed production-browser regression callable from CI with an owned strict port and lifecycle cleanup. Currently `package.json` and `.github/workflows/check.yml` run Node tests/build, while `tests/browser/README.md` requires a separately available MCP runner and hardcodes 5183. There is no browser release signal in automatic CI. Do not add a broad test stack just to mask the immediate line-ending bug.
4. Address measured **E3** and instrument the daily-use history path in **E4** before a larger product slice. Keep performance work tied to input/render evidence and representative histories.
5. Validate storage failures beyond injected `add`: transaction abort, database-open failure/blocked upgrade, deletion failure, lost tab during pending save, entirely corrupt/unindexable histories and duplicate retry identity. Existing unit storage tests mainly validate JSON; added browser migration/quota checks do not cover every transaction failure.

**Untested platforms/limits:** physical Windows/macOS/Linux IME, dictation and virtual keyboards; Firefox/Safari/iOS/Android; real screen-reader reading order and announcement behavior; forced colors/high contrast, actual browser UI zoom and magnification; physical low-end hardware; real background-tab timer throttling; populated multi-year histories; rollback from database v2 to an older app. Composition/repeat source tests do not certify OS input. Transparent native text/caret and reliance on a mirror (`style.css:135`) specifically warrant real forced-colors and AT checks; no failure is asserted without that exercise.

CI uses a floating Node 24 minor on Ubuntu and Python 3.14 for the separately owned ML lane. Dependencies have a lockfile and explicit frontend versions; no acquisition/training occurs in the reviewed CI. A fresh frontend build is reproducible here, while an exact historical byte reproduction across toolchain versions and a fresh remote CI pass were not established. No independent ML or design conclusion is made by this lane.

The smallest useful handoff is **cross-platform green checks → explicit native editing contract → bounded input/history performance → release evidence**, alongside Claude's design conclusions and the learning/ML lanes. No new product preference needs to block those engineering steps.

<oai-mem-citation>
<citation_entries>
MEMORY.md:582-588|note=[historical TypeForge runtime context checked against current Windows evidence]
</citation_entries>
<rollout_ids>
01a0f277-a0ec-7fa3-b73d-ea18080768ac
</rollout_ids>
</oai-mem-citation>
