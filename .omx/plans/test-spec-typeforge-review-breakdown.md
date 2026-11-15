# TypeForge review breakdown: acceptance and verification specification

**Status: Planner revision 3, 15 November 2026; awaiting sequential Architect then Critic re-review.** Companion: `prd-typeforge-review-breakdown.md`. All requirements below describe future verification, not implemented fixes. Source baseline remains `de69444a6201da96281ca9ad88088904477775a2`; review/artifact commits do not establish application changes. Planning only: no implementation or deployment handoff.

Client-relative source/test paths below resolve under `typing-app/client` (application modules under `src`); review paths are workspace-relative.

## Evidence and honest baseline

| Evidence | Receipt and limitation |
|---|---|
| Actual Claude design | `docs/reviews/2026-11-15/design-review.md` and `design-evidence/`; completed current UI/Monkeytype evidence |
| Actual Claude Keybr/benefit review | `.omx/plans/typeforge-claude-benefit-review.md` plus `.omx/plans/typeforge-claude-clarifications.md`; addendum supersedes wrap/cue/status ambiguity and earlier wrong draft-hash prefixes |
| Independent learning | `docs/reviews/2026-11-15/learning-review.md`, `learning-evidence/source-probe.json`; 43 targeted tests reported passing, synthetic coverage is not human effectiveness |
| Independent engineering | `docs/reviews/2026-11-15/engineering-review.md`; check 94 pass/3 fail of 97, failures in LF-only source extraction against CRLF; separate typecheck/build pass; Chromium 39/39, zero errors |
| Independent ML | `docs/reviews/2026-11-15/ml-review.md`; 21/21 targeted TypeScript tests; Python 19 pass/2 missing-sklearn errors in available Python 3.11 versus documented pinned 3.14. No refit, dependency installation or full reproduction claim |
| Performance | Engineering same-harness 1x/4x/1x handler p95 4.9/71.3/5.0 ms, 80 native edits at 20 ms intervals; no dropped characters. rAF proxy is not physical input latency or complete causal profiling |
| Planning review | `.omx/plans/typeforge-architect-review-1.md`: ITERATE. Revision 3 addresses the remaining iteration-2 deletion-bound blocker (`.omx/plans/typeforge-architect-review-2.md`); Architect re-review then Critic remain required. No initial specialist audit remains pending |

Keep receipts tied to source/build/browser, command, fixture and clock mode. Accelerated browser-clock checks do not prove real timing, physical IME, actual screen-reader speech, Firefox/Safari or real browser zoom. No configured lint task exists; do not claim one passed.

## V0 - Repair trustworthy checks and establish the paired baseline

**Resources:** `tests/app.test.ts` extraction sites around lines 37, 80, 350; current app handlers; existing package scripts and browser harness.

- Before behavioral changes, reproduce the three extraction failures. Test source-boundary extraction with LF and CRLF, require start/end markers to be found in order, then execute the same existing restart assertions. Do not disable assertions or swallow missing boundaries. A source-slice repair is not an application fix.
- From `typing-app/client`, run `npm run check` and a separate `npm run build` if the chained check stops at tests. Browser verification follows `tests/browser/README.md`: start the production preview with `npm run preview -- --port 5183 --strictPort`, then invoke the available Playwright MCP `browser_run_code_unsafe` with `filename` set to the absolute path of `typing-app/client/tests/browser/typing-flow.js`. Require `failed: 0` and an empty `errors` array; own and clean up only the preview started for this check. There is no browser npm script or automatic browser CI signal currently. If the runner is unavailable, report that gap. Record exact outputs; do not relabel the current 94/97 baseline as green.
- Profile the same real-clock 1x/4x/1x native-input harness before/after relevant rendering changes. Include handler distributions, long tasks, textarea value/selection, mirror work and dropped/duplicate characters. Use traces to attribute cost before optimizing. Preserve input correctness; any regression beyond repeat-run variability must be explained and resolved or explicitly excluded from the release claim. Do not invent a universal 16 ms guarantee from one machine.

## V1 - Entry, preferences and safe focus (AC1)

**Resources:** `app.ts` routes/preferences/focus; `tests/app.test.ts`; browser typing flow.

Fixtures: first visit; return; manual pair valid/stale; Recommended unavailable; URL override; valid/invalid/deleted retest origin; blocked/corrupt/partially invalid preferences; reset; slow history; an already-focused control.

- Validate each preference field independently. One malformed field does not discard unrelated valid preferences. Explicit URL and compatible lineage take documented precedence; no value guesses a keyboard layout. Practice may default to 30 seconds; assessment keeps its existing 60-second default and exact compatible settings.
- QWERTY declaration gates eligible timing interpretation, not General/manual typing. Optional declaration refusal still yields a useful practice session. Preference failure never blocks input or save; resetting preferences does not delete results.
- Intentional ready entry or a completed practice repeat may focus the native input only while focus is neutral/body/stage. A delayed callback must not steal focus from a select, button, link, contenteditable, another input or modal. Click on an eligible blank stage focuses it.
- **No global printable-key capture/replay.** A printable key already delivered to the native input is accepted once; elsewhere it is untouched. Tab navigates normally. Ctrl/Alt/Meta shortcuts, composing events and control activation are not hijacked.
- Continue Typing is a real button activated with Enter. If a document-level Enter recovery shortcut exists, it is restricted to body/neutral stage, no modifiers/composition, and cannot consume a focused control's activation. Timer starts only at the first accepted insertion.
- Verify real AT focus behavior before claiming accessible autofocus. If it fails, use explicit user-action recovery or opt-in autofocus; no invisible focus trap is acceptable.

## V2 - Coherent UI prototype and native editing geometry (AC2)

**Owner:** actual Claude for design and visual verdict; engineering for input/geometry invariants. **Resources:** `DESIGN.md`, `app.ts`, `style.css`, native mirror/input rendering, browser fixtures.

Before broad UI implementation, compare two bounded coherent prototypes: refined current structure and the practice-stage direction from Claude. Each covers ready focused/unfocused, running, first mismatch, corrected mismatch, focus loss, completion, save failure, returning home, Progress empty/populated and insufficient-evidence fallback. Record the selected layout, information hierarchy, colour/type/spacing roles and rationale. This is a design checkpoint, not permission to rewrite the framework or an efficacy claim.

Geometry matrix: 1440x900, 390x844, 320 px, plus actual browser 200% zoom; same seeded assessment and practice fixtures across widths. Include typed prefix ending inside a word, line-edge insertion, extra character, middle edit, Shift+Arrow selection, pointer caret placement, selection replacement, Backspace, Ctrl+Backspace and passage commit.

- Assessment passage IDs/order/text/settings are identical at every width. No width-based filtering, shortening, reweighting or reordering. Any future content change needs a separately versioned practice policy/exposure contract; this layout release cannot change benchmark content.
- The textarea contains only the response; the mirror also contains the untyped suffix. Therefore identical CSS alone is insufficient. Capture actual caret/selection and corresponding rendered character geometry for partial-word and extra-character cases. Demonstrate aligned lines, click placement and scrolling across the matrix before changing wrap strategy. Tape remains a prototype until it passes; retain existing wrapping if alternatives cannot preserve native correctness and record that limitation.
- Completed passage text stays noneditable. No custom caret, printable-key replay or fabricated timing may substitute for native input behavior.
- Use a non-flow marker at the **first positional mismatch**. A pointer near the caret is conditional on the mismatch occupying a different visual line or being outside the stage. Do not move the mismatch marker merely to follow the caret, infer arbitrary inserted-character alignment, or reinterpret positional scoring.
- Visual cues are aria-hidden where a stable accessible description provides equivalent information. Committed previous errors may retain static underlines; active cue clears. Avoid additional synchronous layout reads on every keystroke solely for a pointer.
- Apply Claude's legibility/placement direction: passage at least 22 px desktop/18 px mobile; required large context contrast at least 3:1; active line within the reviewed upper 40-45% viewport region in ordinary ready/running states. Record unavoidable zoom/keyboard exceptions rather than force clipping. Colour is not the sole error/focus signal. Nonessential transitions at most 150 ms, disabled for reduced motion.
- Measure stage bounding rectangle and active-line position before/after feedback, commit and completion. A zero CLS score alone is insufficient. Feedback must not repeatedly shift the typing stage.
- Reserve a stable feedback slot: integrity/Undo notice outranks transient hint; newest equal-priority notice wins; each new notice is announced once. Repeated paint does not reannounce it. Recovery button and low-weight identity caption remain accessible. Why is active only ready/results or visibly unavailable during running; never an apparently active focusable link that silently does nothing.

Automated screenshot/geometry/semantics results are separate from actual-Claude visual approval, human usability and real screen-reader announcements. A future usability session asks participants to begin, recover focus, correct a mismatch, repeat and find progress; record completion, confusion, accidental edits and preference without claiming representative adoption from a small sample. Human efficacy is not a Stage 1 gate. Missing human/AT coverage must remain visible in the release claim.

## V3 - Result continuation, lineage and observed practice (AC3/AC4)

**Resources:** `app.ts` ready/results/Progress, `engine.ts` result types, `storage.ts`; existing lineage tests.

- Practice Again produces a new run ID with compatible settings and retained Manual choice; Recommended revalidates evidence at the next preparation and explains General fallback. It never rewrites the previous result or frozen prediction.
- Assessment primary continuation is Practice Next; an assessment retest remains a separate lineage-aware action. Do not turn Again into same-content benchmark rehearsal. Verify fresh/practice/assessment identities and exclusion rules independently.
- A never-linked practice result does not imply a deleted assessment. Missing, corrupt, deleted or incompatible actual origins remain unavailable; no fabricated lineage.
- Save failure remains visible while navigation/repeat is usable, without duplicating saves or implying persistence. Export/Delete keyboard activation is not stolen by global handlers.
- Current history already includes practice. Preserve its rows while adding readable observed activity; existing assessment trends stay assessment-only. Separate duration, context, corpus/instrument versions and practice/assessment labels where comparisons require them.
- Today/week counts use explicit local-calendar boundaries, including midnight/DST fixtures. Call elapsed recorded session time session time; do not call it active typing. Flagged sessions can be shown separately with their status. Empty history, thin evidence and unavailable summaries still provide a General/manual next step.
- No-effect/insufficient evidence never displays a false Suggested recommendation. Observed counts are not mastery, streak obligation, trainability or recovered-WPM claims.

## V4 - Bounded optional data and stale-result safety (Stage 1C)

**Resources:** `storage.ts` indexed pagination; `app.ts:52-68,151-183,665-698`; current calibration and progress reads.

Use small, large, mostly-invalid, mostly-incompatible, oversized-row, blocked/rejected and deliberately delayed fixtures. Count **examined** rows, not just valid returns.

- Initial optional slices stop at 25 examined rows or 4 MiB serialized payload; automatic lookup stops at 500 examined rows or 16 MiB. Yield between slices and cooperatively between bounded operations once synchronous aggregation reaches 8 ms. A single validation/serialization cannot be preempted: record its duration and any overshoot, then yield before the next operation; do not assert a hard 8 ms ceiling. Return last-examined compound cursor, completion and exclusion/budget status. Single-record IndexedDB materialization is an explicit limitation, not a claimed hard heap bound.
- General/manual shell and input become usable while optional summaries/profile/calibration remain unresolved. Manual catalogue does not depend on lifetime reads. An incomplete profile abstains; partial summaries cannot appear as exact totals. Explicit continuation resumes bounded work.
- Render 25 initial rows, at most 100 row elements concurrently. Next/Previous replace the visible page; tie timestamps and invalid records do not skip or duplicate valid results. First page does not wait for totals.
- Generation token plus data revision prevent delayed results after navigation, restart, settings change, deletion/reset or run start from attaching stale suggestions, counts or predictions. Exercise each race by resolving requests in reverse order. Cancel where supported; correctness cannot depend on cancellation succeeding.
- Freeze accepted evidence when a run starts. Cross-tab deletion affects next preparation; it does not mutate the active instrument. Never attach a late prediction to already-observed typing.
- Preserve **exact newest-ten compatible assessment calibration**; optional-profile scan caps do not silently truncate it. Assessment shell may load early, but exact preparation remains separately paged/yielding/cancellable. Retest cannot begin with unresolved origin/compatibility. Cancel returns to General. Any altered assessment calibration needs its own explicit instrument decision.
- Copy says ordinary export contains valid readable records only. Corrupt rows remain retained; no false raw-recovery promise or silent deletion. Full export remains user-requested and separate from page/typing readiness. A later size-evidenced bounded export task chooses format/UX with Claude; multipart export is not required for this increment.

## V5 - Undo/Redo accounting and versioning (separate Stage 1D)

**Resources:** `app.ts:127-148` input reconstruction, `engine.ts:260-298` invalid/edit accounting, strict storage validation, calibration/profile/trend/retest comparators and tests. This is independent of layout release: an honest Undo integrity notice can ship while the repair is still unimplemented.

The proposed contract is a bounded accepted-edit journal and uniquely matched same-passage history replay. Validate real browser history grouping, not merely synthetic historyUndo events.

| Fixture | Required accounting/eligibility |
|---|---|
| Type abc, Undo to ab, Redo to abc | Visible text and selection match native history. Original insertion attempts/first-position error counts do not decrease or increment on replay; no new synthetic key timings. Retained-text WPM follows visible response. |
| Genuine new insertion after Undo | Counts as a new observed attempt under ordinary rules; prior attempts stay counted. Redo history invalidates consistently with native behavior. |
| Word deletion/selection replacement, coalesced Undo/Redo | Replay accepted only when journal uniquely explains the transition. Deletion accounting counts actual removals, including replay; fixture expectations are explicit. No arbitrary diff promoted to clean physical timing. |
| Supported replay in a sentence | Mark touched sentence edited; exclude its pair/prediction matches while retaining supported run-level accuracy. Frozen earlier predictions stay unchanged. |
| Unmatched/ambiguous transition, exhausted journal, cross-commit history | Conservative unsupported handling and visible integrity notice; no invented alignment/timestamps or clean eligibility. Retained active-passage text is restored where cross-commit native history would breach the passage boundary. |

Journal bounds must respect existing response/attempt caps and a separately explicit replay cap before implementation; overflow takes the unsupported path. Show exact expected counters for insertion, replacement and deletion fixtures before coding.

Deletion-bound fixtures preserve the current `MAX_ATTEMPTS = 16,384` strict storage bound and exercise **all** accepted removal paths, not only replay counts:

- With accumulated deletions 16,382, an admissible one-character removal is accepted at 16,383 (below); a two-character removal is accepted at 16,384 (at); a three-character removal is rejected atomically (over), leaving 16,382 and the prior text/selection/counters/journal unchanged. Repeat for supported Undo, Redo removal, ordinary deletion after replay restoration and selection replacement, with valid reachable prior histories.
- Repeatedly remove and restore a 600-character response: 27 accepted removals total 16,200; the 28th attempted removal would yield 16,800 and is rejected, retaining the restored response and 16,200 deletions. Original insertion attempts remain 600. Also test substantial pre-existing deletions and cross-passage cumulative totals; a fresh journal/passage cannot reset the guard.
- At exactly 16,384, zero-removal edits can still be admitted under other existing caps; any positive removal is rejected. Test cancelable beforeinput and restoration after a noncancelable native event, including pre-edit selection direction/range. No accepted counter, journal entry, timing or frozen prediction changes on rejection; a truthful deletion-limit notice appears. Timer continues, and completion/restart remains usable. Subsequent unmatched native history uses the conservative existing fallback, not invented reconciliation.
- Finish the retained session normally after each boundary case; assert exact retained text, attempts/errors and deletions, strict v2 result validation, storage round trip and ordinary valid-record export without clamping or loss. Replay rejection alone must not erase valid accuracy. Preserve v1 fixtures and rejection of counts over 16,384; never widen v1 validation or defer the guard until save.

Proposed version contract: new runs use `metricVersion: 2`; old v1 results remain immutable/readable/exportable. Existing schema shape/input mode remains unless explicitly required otherwise. Validators admit only the intended version enum; calibration, trend, retest and profile accept the target generation and never pool v1/v2. Test old/new fixtures, incompatible retest, empty new cohort, mixed history and older-app downgrade/export limitations. Architect may select a separate instrumentation-version field only by revising the contract before coding, not by an executor silently changing this proposal. A version bump alone is not evidence that replay semantics are correct.

## V6 - Numerical abstention and executable coaching contract (Stage 1A, 2A/2B)

**Resources:** `profile.ts`, `model.ts`, `corpus.ts`, strict config/result validation and targeted tests.

Immediate numerical regression: constant 200 ms histories, many summation orders, random permutations and the actual engine ten-sentence fixture must abstain instead of choosing roundoff-sized targets (review observed approximately 1e-12). Also preserve clearly supported nonuniform fixtures. Numerical tolerance is not the practical minimum-effect or learning-efficacy threshold.

Before adaptive implementation, Stage 2A outputs `.omx/specs/typeforge-practice-policy-v1.md` (future resource), a config schema, examples and boundary fixtures for **one** simple policy. It must contain concrete support/opportunity, effect, uncertainty/stability, freshness, context/version, window/budget, exposure/diversity and retirement rules, with units and fallback reasons. No TBD thresholds handed to an executor. Record sensitivity evidence and conservative product rationale; do not label these scientific optima. ML/learning/Architect review the contract and actual Claude reviews explanations. If support cannot be justified, a concrete General/manual-only policy is a valid bounded outcome and Stage 1 still ships independently.

Contract verification requirements:

- Boundary fixtures immediately below/at/above every threshold; equal/near-equal candidates, permuted data, all-accurate/all-error, stale/partial/insufficient evidence, duration/layout/language/corpus/version mismatch and shared-browser context reset.
- Independently validate coach config identity/schema/baseline parameters/thresholds/context support. Test valid coach + missing/malformed Ridge, invalid coach + valid Ridge, both valid and both invalid. Candidate failure must not silently alter policy identity or disable valid independent coaching evidence; General/manual always usable.
- Fix strict provenance persistence deliberately (reviewed result extension or sidecar); legacy records are not rewritten. Stored support/source IDs/config/version must trace to accepted sources. Deletion/reset invalidates the next derived snapshot.
- Timing uses eligible clean evidence; separate error-opportunity counts cannot treat excluded/unfinished/edited samples as clean timing. Quantify eligibility yield and exclusion reasons instead of assuming public-data coverage equals local usefulness.
- Validate actual sampled exposures/diversity across seeded sessions and the realistically completed prefix, not only whole-bank averages. Honor the selected fallback when dose/support fails. Keep dose checks separate from claims of transfer.
- No prediction of recoverable WPM, trainability or learned mastery from residual MAE. Personal timing/observed difficulty and intervention effectiveness are different claims.

## V7 - Privacy, reliability, compatibility and reproduction

- Local response/prompt text, timestamps and aggregates are sensitive exported session data, not anonymous data; raw keydown/keyup streams are not currently persisted. Inspect network behavior in the tested journeys before claiming no uploads. No telemetry/account/cloud dependency is introduced by this plan.
- Preserve input caps, safety stops, immutable saved results and prediction snapshots; test corrupt storage, save failure, unavailable model/config, deleted origins and repeated restarts. No destructive cleanup defaults.
- Keep assessment content/settings/lineage and historical versions unchanged outside the explicit separately reviewed Undo instrument generation. Layout changes cannot become content changes.
- Re-run focused model/profile TypeScript tests when those boundaries change. Full Python reproduction uses the documented pinned environment through its owner when relevant; current missing-sklearn errors stay visible, not fixed by silently changing dependencies/pins. Preserve Aalto attribution/noncommercial source boundaries; do not invent derivative-model licensing conclusions.
- A later authorized build receipt should link source SHA and instrument/corpus/policy/model/report identities. Current live JS/CSS byte parity is two observed assets, not a full deployment SHA/all-asset/browser certification. No deployment is part of this plan.

## V8 - Later improvement evidence without delaying useful practice

Stage 3 is optional research/monitoring, not a gate for Stage 1 UI quality. Persisted aggregate log sums cannot reconstruct MAE: if local matched-loss monitoring is later authorized, accumulate loss and hit counts while matches are observed, with model/policy/instrument context and exclusion counts; do not backfill fabricated errors from means. Current ranking support was 0/151 rows meeting the five-pair condition; do not call that recommendation quality. Public Enter-task versus local timed-Space transfer and nominal uncertainty calibration remain limitations.

Before any efficacy claim, distinguish usability/adoption, eligible-signal coverage, target relevance, delayed retention and general-text transfer. Define worthwhile effects, comparison, uncertainty and consent before collecting data. No enrollment/account/telemetry is required for ordinary local use or near-term release. A clearly explained General/manual product can remain the final adaptation decision.

## Handoff, evidence packet and stop condition

After planning approval and separate execution authorization, use small behavior-focused Git commits with regression-first tests where missing. Preserve shared-file ownership and others' changes; avoid new dependencies without explicit need/authorization. Separate harness/numerical, prototype/UI, bounded data, Undo/version and policy changes. Run targeted tests first, then relevant type/build/browser checks; inspect actual command definitions rather than inventing scripts.

Each increment supplies source/commit identity, changed resources, regression evidence, failures, visual-state captures where relevant, actual-Claude verdict and explicit human/AT/device gaps. Independently review the integrated journey before completion. Stop broadening when that increment's contract passes; escalate a concrete failure or unsupported policy, not a hypothetical requirement for a new study.

This specification is complete as revision-3 planning input. Architect then Critic must re-review the exact revised bytes; planning approval is not implementation authorization, and no application checks above are claimed freshly run by this drafting step.
