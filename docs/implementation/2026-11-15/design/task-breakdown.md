# Design lane: task breakdown (Stage 1 prototype checkpoint)

15 November 2026. Owner: actual Claude design lead (Orca Task `task_5817cddd1505`, Dispatch `ctx_4eb9b70f7ce6`). Workspace `typeforge-design-prototypes`, branch `OwenC05/typeforge-design-prototypes`. Written before any prototype edit.

## Inputs and bases

- Brief: `.omx/plans/typeforge-design-dispatch.md`; mandatory constraints: `.omx/plans/typeforge-execution-handoff-20261115.md`.
- Approved PRD and test spec: `.omx/plans/prd-typeforge-review-breakdown.md` (Stage 1, AC1–AC4) and `.omx/plans/test-spec-typeforge-review-breakdown.md` (V1–V3). Receipt `typeforge-planning-receipt.json`.
- Design evidence: `docs/reviews/2026-11-15/design-review.md` (F1–F13, Directions A/B/C), `.omx/plans/typeforge-claude-benefit-review.md` §3.3–3.4 and §5, and the superseding `.omx/plans/typeforge-claude-clarifications.md`. Where these differ, the clarifications win on wrapping, corpus, error cue, run-visible status and hashes.
- Application source baseline `de69444` (verified: `git diff de69444 HEAD -- typing-app` is empty). Review/planning base `45d2da7`. This branch's start is `a991cfa`.

## What this lane delivers, and what it does not

**Delivers:** two independently built, working local prototypes on the real TypeForge engine, each on its own branch and child worktree, with comparable screenshots, geometry evidence and a recorded list of failed and untested criteria. Then a lead comparison in `prototype-comparison.md`, with reliable preview commands for Owen's visual-direction checkpoint.

**Does not:** merge A and B together, integrate either into `feature/daily-practice`, change `DESIGN.md`'s final direction, start ML/Undo/schema/policy work, deploy, push, or claim human preference, learning, AT, IME or device results.

## Directions

| ID | Direction | Brief |
|---|---|---|
| A | Refined current layout | Keep today's page structure (Home → Practice → Results → Progress, ML Lab). Trim run chrome, fix hierarchy, type, spacing and colour roles, add ready state, stable feedback slot, in-place continuation affordances where the current structure allows. Benefit review §3.3 "refined current layout"; design review Direction C plus A's acceptance. |
| B | Practice stage | The passage is the largest object near the top third; run chrome is a mini timer and restart; a compact practice-state strip sits above the stage; the result appears in place with **Again** as default and details expandable; Home for a returning user **is** the stage. Benefit review §3.3; design review Direction A. Not Direction "Today's session" (B in the design review): no guided sequence or adaptive targeting. |

## Shared contract for both children (non-negotiable)

1. Real engine: `typing-app/client/src/engine.ts`, `corpus.ts`, `storage.ts`, `profile.ts`, `model.ts` behaviour is reused. No change to scoring, assessment/retest selection, lineage, storage schema or result semantics. Layout code must not feed `selectPrompts`/`selectDrillPrompts`/retest exclusions; the same seed/mode/settings/lineage must yield byte-identical prompt IDs and order at 320, 390 and 1440 px.
2. Native `<textarea>` owns caret, selection and composition. Keep the response mirror. Error cue = out-of-flow (`position:absolute; pointer-events:none; aria-hidden`) expected-glyph marker at the **first unresolved positional mismatch**, plus a caret-side pointer only when that marker is off the caret's visual line or outside the visible stage. No edit-distance alignment. Committed context lines keep static error underlines. No extra synchronous layout reads per keystroke beyond the existing paint pass.
3. No global/document printable-key capture. Contextual autofocus only on intentional entry and only when focus is neutral (body/stage). A real "Continue typing (Enter)" button for focus recovery.
4. One reserved fixed-height feedback slot attached to the stage: integrity and Undo notices outrank transient hints; newest equal-priority wins; polite live region announced once per change. Static low-weight block-identity caption. "Why?" is active only in ready/result; during a run it is visibly unavailable and not focusable.
5. Undo copy is truthful about today's behaviour (accuracy unavailable, run excluded). After any edit, optional predictions stay frozen/unattached.
6. Mock summary/profile data only via an explicit, visibly labelled prototype fixture switch (e.g. `?fixture=…` showing a "Prototype fixture" badge), never written to the `typeforge` IndexedDB or preferences in production paths. No fake "Suggested" targets, learning gains or adaptation. Insufficient evidence renders General plus an abstention reason.
7. No new framework, dependency or theme system. Navy/teal identity kept; colour **roles** may be refined (teal = active/positive now). Spacing on the 8 px scale. Added transitions ≤ 150 ms, off under `prefers-reduced-motion`.
8. Test tooling: `playwright-core` installed only under the child's own scratchpad (as the 15 Nov design review did), driving system Chrome 157 headless. It is not a project dependency; `package.json`/lockfile stay unchanged.

## Comparable state inventory and screenshot names

Each child produces the same set, named `{vp}-{id}-{slug}.png` with `vp` ∈ `1440`, `390`, `320`, under `docs/implementation/2026-11-15/design/prototype-{a|b}/screenshots/`.

| id | State |
|---|---|
| s01 | Idle, input focused (ready) |
| s02 | Idle, input unfocused (ready, recovery affordance visible) |
| s03 | Running, no error |
| s04 | First mismatch on the active line (marker visible) |
| s05 | Caret several words past the mismatch / on a different visual line (pointer visible) |
| s06 | Mismatch corrected |
| s07 | Focus lost mid-run (integrity notice + Continue typing) |
| s08 | Undo notice in slot |
| s09 | Completion with Again (practice) / Practice next (assessment) |
| s10 | Save failure at completion (injected in isolated context) |
| s11 | Empty history / first visit Home |
| s12 | Insufficient evidence (General + abstention reason) |
| s13 | Returning Home (saved prefs + at least one result) |
| s14 | Practice summary / Progress (observed counts; fixture labelled if used) |

Plus `geometry.json` (per width: active-line top as % of viewport, stage box before/after s04/s07/s08 events, passage font size, prompt-ID list per width) and `journey-log.json`.

## Task list

| # | Task | Owner (agent / model / effort) | Allowed files | Depends on | Validation / artifact |
|---|---|---|---|---|---|
| L0 | Read inputs, write this breakdown, allocate resources | Lead, Claude `claude-opus-5-5` (inherited) | this file | — | committed file |
| A1 | Inventory current UI vs Stage 1 criteria for Direction A; decide hierarchy, type/spacing/colour roles | Child A, Claude `claude-opus-5-5`, effort high | `prototype-a/notes.md` | L0 | notes committed before code |
| A2 | Ready/running/result layout and colour roles in the existing pages | Child A | `typing-app/client/src/app.ts`, `style.css`, `*.html` in `typing-app/client` | A1 | typecheck/build; screenshots s01–s03, s09 |
| A3 | Feedback slot, first-mismatch marker + conditional pointer, focus recovery, Undo/integrity copy, inert Why | Child A | same | A2 | s04–s08 + stage-box/line displacement = 0 |
| A4 | Returning Home, empty/insufficient evidence, practice summary (labelled fixture if needed), save failure | Child A | same + `prototype-a/fixtures` if needed | A2 | s10–s14 |
| A5 | Geometry and regression proof; evidence pack | Child A | `tests/` additions allowed only as new files; `prototype-a/**` | A3, A4 | `npm test`, `npm run build`, existing `tests/browser/typing-flow.js` result, geometry matrix, prompt-ID identity, screenshots ×3 widths |
| B1–B5 | Same decomposition for Direction B (stage layout; Home = stage; in-place result with Again) | Child B, Claude `claude-opus-5-5`, effort high | same file set in **its own worktree**; evidence under `prototype-b/**` | L0 | same validation |
| L1 | Rerun each child's preview and a spot check of its geometry/states, sequentially (never both browsers at once), and read the screenshots | Lead | none (scratchpad) | A5, B5 | notes in comparison |
| L2 | Compare A vs B against AC1–AC4, §3.4 table and the clarifications; record strengths, tradeoffs, recommendation, untested claims | Lead | `prototype-comparison.md` | L1 | committed file |

Within each child, A1–A5 (B1–B5) are sequential because they share `app.ts`/`style.css`. The children run in parallel because they are in separate Orca child worktrees and never share a source tree.

## Resource allocation

| Resource | Child A | Child B | Lead (L1, sequential) |
|---|---|---|---|
| Worktree | Orca `new-child` of this workspace, name `tf-proto-a` | Orca `new-child`, name `tf-proto-b` | this workspace |
| Branch | as created by Orca for `tf-proto-a` | as created for `tf-proto-b` | `OwenC05/typeforge-design-prototypes` |
| Preview / dev port (`--strictPort`) | 5291 | 5292 | 5293 (A), 5294 (B) |
| Browser profiles | child scratchpad `…/proto-a-*` | child scratchpad `…/proto-b-*` | lead scratchpad |
| Performance benchmarking | **none** (sibling builds/browsers would confound it); E3 non-regression stays an open gate | none | none |

Background processes start hidden (`Start-Process -WindowStyle Hidden` or Node `windowsHide`), are tracked by PID, and are stopped by their owner before `worker_done`. Nobody touches Portfolio, the original TypeForge checkout, `typeforge-daily-practice`, `typeforge-foundation` or their ports (5183, 5187 and anything already listening).

## Model and effort decisions

- Children: `--agent claude --model claude-opus-5-5 --effort high`. Rationale: layout and interaction design are consequential; `claude-opus-5-5` is an identifier observed in this Orca host (this lead's own session and existing Dispatches), not an assumed alias. `claude-fable-5-2` is also observed in the host, but its relative fitness for this work is unverified here, so it is not chosen silently. Requested settings are recorded separately from each child's self-reported receipt; applied effort is not inferred from telemetry.
- No Codex child in this wave: the handoff caps immediate children at two, and both slots go to the Claude design directions. Bounded geometry reruns are done by the lead (L1). If a technical-only verification gap remains, the lead names it for root rather than adding a third child.
- Lead model: inherited `claude-opus-5-5`; root's coordinator model is not changed.

## Failure handling

A child that cannot pass a geometry case keeps the existing geometry-safe behaviour for that case, documents it as failed, and still delivers. A failed or unknown launch follows the Orca recovery reference; it is never silently rerun. If one direction fails entirely, the comparison records that honestly rather than presenting one option as a choice.
