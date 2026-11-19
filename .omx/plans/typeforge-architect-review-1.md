# Ralplan Architect review — iteration 1

Verdict: **ITERATE**. Completed by native installed `architect` role `/root/review_breakdown_architect`, after Planner completion. This coordinator record condenses the returned review while preserving its blockers, reasoning and evidence. It is local lifecycle evidence, not execution authorization.

Reviewed PRD/test-spec at `b9a2fb9`; application source unchanged from `de69444`. Exact SHA256:
- PRD: `53dbe1cc6749e6f4e654455e28a81815c2328a2a41e567b8f42825a954d7b70e`.
- Test specification: `40850bfc9a42d7050127e3d2ec46fb829852dc25ce505caea04a433adf3f47d9`.

Read completed design/learning reports, newly completed ML/engineering reports and Claude's Keybr challenge. Final Claude clarification was pending. No new browser/test execution and no file edits by Architect.

## Strengths and root cause

The plan preserves native input, immutable results, assessment compatibility and frozen predictions while separating a derived practice profile. Assessment-only history is explicit in `profile.ts:18-31`; predictions freeze before observation in `app.ts:205-210`. Mechanical, usability and learning claims are correctly distinguished. General practice can improve before adaptive coaching is ready.

The product organizes its strongest machinery around assessment evidence, while daily practice needs immediate readiness, coherent repetition and visible changing practice state. Reusing assessment calibration as coaching would conflate those purposes.

## Required revisions

1. **UI scope.** PRD lines 21/152 prematurely prohibit broad redesign/theme replacement. Claude's comparative evidence supports a coherent practice/results/returning-Home/Progress layout and information-architecture comparison. Permit that visual/interaction workstream with state inventory and prototype checkpoint, without an unnecessary framework/backend rewrite or implementation during Ralplan. Theme replacement currently lacks supporting design evidence; this is not a prohibition against meaningful UI redesign. Screenshots do not establish human preference or retention.

2. **Geometry and correction.** `app.ts:254-261` mirrors typed response plus untyped target suffix; textarea contains only typed response. Word wrapping can diverge even with identical CSS. Require partial-word/extra-character line-edge, click mapping, selection, Ctrl+Backspace and passage-boundary cases at 1440/390/320 and real zoom. Horizontal tape is a prototype, not a proven fix. Do not filter/rewrite assessment passages by viewport: layout-only first, otherwise explicit policy/provenance/compatibility decision. First-mismatch anchor versus always-near-current-caret is contradictory when typing far beyond an error; actual Claude must settle it. Measure stage/line movement directly, not only aggregate CLS.

3. **Engineering contracts.** E1 is a small prerequisite: 94/97 Node tests pass, 3 LF-dependent source-extraction failures on CRLF; separate build and 39 browser assertions pass. Repair without disabling assertions/new framework. E2 is not rendering-only: historyUndo/Redo falls to `tracked:false` (`app.ts:127-148`), disables diagnostics (`engine.ts:260-265`) and makes accuracy null (`205-214`). Specify attempt/error accounting, timing exclusion, selection/word deletion/passage boundaries and whether changed semantics need an instrument/metric compatibility distinction. No fabricated timestamps or rewritten history. Split this from unrelated visual polish. E3 needs targeted profiling and the same paired harness; its constrained-browser p95 is not a universal device verdict.

4. **Bounded optional history.** Between-block work is not inherently bounded. Calibration may scan all history to find ten summaries (`app.ts:52-68`) and is awaited before render (`151-183`); Progress reads all (`665-668`, `storage.ts:283-291`). Separate basic General/manual readiness, optional profile/activity work, lineage-dependent retest preparation, visible pagination and full export. Specify bounded reads/processing for the new practice profile, delayed/failed/mostly-incompatible history fixtures, no late changes to an active block, stale async result rejection on restart/navigation, bounded visible rows. Reuse indexed pagination (`storage.ts:294-337`). Do not silently cap legacy assessment calibration and change its meaning.

5. **ML/policy contracts.** Current any-positive score admits roundoff-only targeting (`profile.ts:52-74`, ML-04); artifact packaging couples baseline policy to experimental Ridge availability (`model.ts:91-97`, ML-05). Require no-effect abstention across accumulation orders, separate numerical tolerance from meaningful effect/support/stability, independently validated coaching config, and strict policy identity/provenance validation. Preserve duration/input/layout/language/corpus isolation initially. Deletion/reset changes future profiles, never frozen past/running snapshots. Define enrichment/context diversity and fallback when corpus cannot deliver them; report actual short-run exposure. Numerical/label correctness repairs do not require human efficacy proof; learning claims do.

## Advisory refinements

- Preference precedence is field-wise; test invalid explicit parameters, missing/incompatible origins, stale manual choices.
- QWERTY declaration gates supported timing, not access to ordinary General practice.
- No global printable-key capture; direct-entry autofocus needs actual AT check, composition/modifiers/controls preserved.
- Essential warnings/save failures/focus recovery are exceptions to simplified running chrome; Claude must clarify rather than allowing a visual-count target to hide status.
- Local response text is not automatically anonymous. No telemetry/accounts/retraining collection is needed.

## Consensus addendum

**Steelman antithesis:** polished General/manual practice may deliver most adoption value. Targeting has sparse coverage, unvalidated decision quality and sometimes lower target exposure; an early adaptive profile can add complexity while presenting questionable personalization.

**Tradeoff tensions:** richer feedback versus native editing geometry; immediate readiness versus trusted history; responsive coaching versus historical comparability.

**Synthesis:** build the Claude-reviewed practice foundation independently, repair demonstrated defects, then introduce one small separately versioned coaching policy after evidence/lifecycle/dose contracts are explicit. General stays useful; Ridge stays experimental.

**Next gate:** revise with all reports and Claude clarifications, then return exact revised artifacts to Architect before Critic. No further broad audit is needed. Claude's original plan-hash prefixes conflict with the independently computed values above and need a correction/qualification; this does not invalidate substantive browser evidence.
