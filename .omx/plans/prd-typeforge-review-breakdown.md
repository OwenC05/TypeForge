# TypeForge: review decomposition and improvement plan

**Status: Planner draft, 15 November 2026. Not consensus-approved and not an implementation handoff.**

Task: “breakdown the review into its constituent parts and problems, and then review how these fixes will improve typeforge”. The desired product is enjoyable, useful daily typing practice with polished existing features. This plan decomposes the current review into causes, fixes and benefits; it does not presume that a more visible model improves typing.

Reviewed application source: `de69444a6201da96281ca9ad88088904477775a2`, `feature/daily-practice`, `C:/Users/Owenc/orca/workspaces/TypeForge/typeforge-daily-practice`. The coordinator subsequently committed completed review artifacts as `ca1a04a`; that does not represent an application change. Context: `.omx/context/typeforge-review-breakdown-20261115.md` and the original handoff. Verification detail: `.omx/plans/test-spec-typeforge-review-breakdown.md`.

Latest steering: Owen endorses the problem breakdown, explicitly elevates UI/UX as a major adoption factor, requests comparison with `https://www.keybr.com/`, and asks for good software engineering practices with Git tracking. UI/UX is therefore a primary product-delivery track, not cosmetic work after ML. Actual Claude's Keybr/three-way comparison and benefit challenge is pending at `.omx/plans/typeforge-claude-benefit-review.md`; this draft contains no invented Keybr findings.

## 1. Evidence and scope

Available independent evidence:

- **D:** `docs/reviews/2026-11-15/design-review.md`, actual Claude review, current screenshots, scripted browser journeys and a live Monkeytype comparison. Its F1–F13 labels are used below. Its visual and UX judgments belong to Claude; this plan reconciles their technical implications rather than inventing a separate design verdict.
- **L:** `docs/reviews/2026-11-15/learning-review.md`, source inspection, 43 passing targeted tests, deterministic/synthetic probes and bounded primary research. Its L1–L8 labels are used below.
- **S:** direct Planner inspection of `app.ts`, `profile.ts`, `engine.ts`, `model.ts`, `storage.ts`, `style.css`, existing test names, `DESIGN.md`, browser test instructions and ML documentation. All short source paths below are relative to `typing-app/client/src/`.
- **Pending:** the independent ML and engineering reports. They must be integrated, or their exact unavailable evidence and consequences recorded, before the coordinator calls the full review complete. No new build, performance, privacy, security, deployment-parity or ML-audit pass is claimed here.
- **Pending design follow-up:** Claude's exercised Keybr comparison and revised TypeForge/Monkeytype/Keybr journey matrix, including first use, returning use, active typing, correction, feedback, recommendation explanation and repeat. Untested competitor paths stay explicitly untested.

Preserve current strengths: native editing and selection, honest experimental labels, local saving/export/deletion, score definitions that retain corrected mistakes, compatible assessment comparisons, and frozen predictions. Do not add a framework, account system, cloud collection, model service, broad redesign or model rewrite to solve these problems. Portfolio and the original checkout remain outside scope.

The initial supported learning task remains keyboard-familiar English copy typing on a declared physical QWERTY keyboard. Responsive layout is still required; it does not establish touch/IME learning support. A beginner curriculum, punctuation/coding packs and multilingual support are separate expansions, not prerequisites to polish this product.

## 2. RALPLAN-DR

### Principles

1. **Practice value first:** optimize entering, continuing and understanding practice before showcasing ML.
2. **Separate claims:** working controls, a responsive policy, useful recommendations and retained typing improvement require different evidence.
3. **Preserve valid evidence:** never rewrite old results/predictions or silently mix assessment cohorts to make progress look better.
4. **Keep the working core:** preserve native editing, local-first privacy and existing utilities; choose the smallest reversible change.
5. **Personalize honestly:** a meaningful general fallback is better than a weakly supported “weakness”; every suggested focus needs provenance and a limitation.

### Top three decision drivers

1. Immediate improvement of usability and UI craft in the repeat daily journey, with adoption treated as a hypothesis to evaluate rather than a promised percentage.
2. A real feedback path from practice to the next useful activity, without compromising measurement.
3. Cost and regression risk relative to what the evidence can currently justify.

### Viable alternatives

| Option | What it delivers | Advantages | Costs/limits | Disposition |
|---|---|---|---|---|
| A. Polish the existing test/practice pages | Focus, remembered settings, correct next action, readable typing/results, practice activity summary | Lowest risk; addresses directly observed failures; useful even without personalization | Recommendation history remains assessment-only; still mostly a collection of tests | Viable minimum release and first increment |
| B. Polish plus one coherent daily-practice loop | A, then a separate practice profile, understandable suggestion/fallback and delivered target-dose checks | Directly addresses Owen's complaint that practice and analysis are disconnected; preserves honest ML status | More state, provenance and deletion semantics; needs ML/engineering reconciliation and policy tests | Recommended direction, delivered incrementally |
| C. ML-first recommendation redesign | Put a learned model into focus selection before fixing the loop | Could become distinctive if it improves decisions; technically substantial | Existing prediction MAE is the wrong success criterion; cold start, sparse coverage and daily friction remain; higher validation burden | Defer as an experiment; not a viable first delivery |

The recommendation is **A as the foundation of B**, with C allowed only after a decision-quality comparison. This is not a commitment to ever-more-complex models. General or simple error/timing heuristics may remain the better product policy.

## 3. The constituent problems and how fixes help

Priority reflects the daily-practice objective, not an invented security severity. **O** = observed by the independent reviewer; **S** = source/probe evidence; **H** = benefit hypothesis requiring user or experimental validation. Effort is relative: S = a bounded component change, M = several coordinated flows, L = a new cross-module contract. These are not delivery-date estimates.

| ID / priority | Underlying problem | Smallest useful fix | How TypeForge improves | Evidence / confidence | Verification / effort |
|---|---|---|---|---|---|
| P1 / High | Entry and return have no remembered typing context; focus starts outside the input | Persist validated preferences; ready/focus state on intentional practice entry; whole-surface focus without stealing other controls' keys | Less setup before each session; returning use feels continuous | D F1/F3/F12 O; `app.ts:151-180,498` S; cause high, habit benefit H | First accepted key, focus exclusion cases, reload/override/reset tests; M |
| P2 / High | Layout and feedback prioritize page chrome over seeing/editing the current text | Apply Claude's compact ready/running layout; word-safe wrapping; in-view warnings; preserve textarea/mirror geometry | Easier reading ahead and correction; fewer hidden interruptions | D F4–F7/F10/F13 O/S; `style.css:127-140`, `app.ts:243-277,403-406`; high for geometry, AT effect untested | Desktop/narrow/zoom screenshots, native selection and correction tests, real AT gate; M |
| P3 / High | Every practice result is treated as a possible assessment retest, even without an origin | Make repeat practice the primary practice-result action; distinguish never-linked, deleted, incompatible and valid origins | A completed block leads naturally to another; removes misleading data-loss language | D F2 O; `app.ts:545-575`, `profile.ts:108-120` S; high | No-origin and valid/deleted/incompatible-origin journeys; settings-preserving repeat; S–M |
| P4 / Medium-high | Feedback is a diagnostic dump; practice is recorded but not summarized as an activity | One understandable observation and next action; details on demand; separate practice-volume summary from assessment trend | Users can explain what they practised and decide what to do next; visits become visible without fake improvement | D F8/F9/F11; L L7/L8; `app.ts:641-695` S; mechanics high, comprehension/return H | Accurate totals, claim/copy checks and Claude-led comprehension check; M |
| P5 / High | Practice never updates the history used for suggestions | Add a distinct, versioned practice-derived profile; update only between blocks; keep benchmark history frozen/separate | New practice can change subsequent suggestions instead of requiring more assessments | L L1/L3 S/probe; `profile.ts:28-47`, `app.ts:383`; high for missing link, coaching value H | Same synthetic practice evidence changes next-profile output; unchanged legacy/assessment bytes; deletion/freshness tests; L |
| P6 / High | A “targeted” schedule is not guaranteed to increase target exposure; score is not a diagnosis | Separate policy from predictor; audit all supported pairs; use a dose-aware sampler with useful general fallback and explicit support | Practice does what its label promises; fewer repetitive or weakly justified drills | L L2/L4/L5 S/probe; `profile.ts:52-105`; high for current mechanism, learning benefit H | General-vs-target exposure/context checks and short-run realized-dose accounting; M |
| P7 / Medium, later | ML evidence measures interval prediction, not which practice helps | Keep Ridge experimental; define a later heuristic-vs-model decision comparison and retention/transfer evaluation | Technical substance serves a user decision; avoids misleading “AI improves typing” claims | L L4/L8; current `model.ts:91-126` and prediction/result paths; full ML audit pending | Promotion gates for coverage, decision quality and learning claim; L/research |
| P8 / Evidence gate | Reliability, accessibility, performance and privacy must survive a changed loop; current independent audit is pending | Incorporate actual engineering defects; preserve current safeguards; validate new persistent state and input paths | Confidence that the smoother experience saves the right data and remains usable | Existing contracts S; engineering severity/findings unknown; do not presume defects or a clean bill | Fresh checks, storage/input failures, performance baseline and egress inspection; effort depends on findings |
| P9 / Medium, later | A small lowercase copy corpus limits freshness and the scope of the product promise | Preserve a versioned assessment bank; first improve variety within the supported practice task; expand task packs only with new contracts | Less repeated material and clearer audience fit; potential transfer becomes testable | L L6 S; `corpus.ts:6-129`, `engine.ts:146-150`; scope high, fatigue/transfer H | Context/repeat inventory; separately versioned new content and held-out tasks; M–L |

### Corrections and limits that change the plan

- **Practice is already in saved history.** `app.ts:683-695` renders both modes. P4 adds a practice activity/goal summary; it does not “fix missing practice storage” or mix practice WPM into the assessment trend.
- **The common-pair dose reversal is real under the stated analytic comparison.** L reports `th` at about 3.151 versus 2.373 occurrences/100 characters and `he` at 3.268 versus 2.408 for general versus the current full-cycle targeted schedule. These are expected corpus exposures, not time-based dose in a short run, human recommendation yield or learning effects.
- **Corrected errors are not lost from all metrics.** Attempt accuracy and expected-key error counts retain them; the clean timing sample excludes the edited sentence. P5 needs a separate coaching observation contract, not relaxed benchmark filtering.
- **A stable target overlay is not a trivial CSS fix.** D F6's proposal must pass native caret/selection geometry tests. A nearer-caret expected-character cue is a smaller alternative if a full stable-target rendering cannot preserve native behavior.
- **Autofocus is contextual.** No global printable-key capture over a select, button, link, editable field, modifier shortcut, composition or AT command. “Zero setup” means the ready typing context, not forcibly moving focus from user-selected controls.
- **Pause is not included in the first fix.** Initially show focus loss immediately and preserve current timed-run interruption semantics. A later practice-only pause would need a versioned clock/scoring contract; assessment validity must not silently change.
- Monkeytype's observed first key focused the input but was absorbed. The comparison supports improving entry/focus, not claiming every competitor first key was scored or that its untested accessibility/editing paths are inferior.

## 4. Delivery sequence and acceptance criteria

### Stage 0 — Finish evidence integration and challenge

**Owner:** coordinator; actual Claude for design reconciliation, native Architect then Critic for Ralplan. **Outputs:** reconciled register, finalized plan/test spec, review dispositions. No application changes.

- Integrate the pending ML and engineering reports with their evidence types and provider receipts. Add real findings to P7/P8; do not populate them with a generic checklist.
- Integrate Claude's Keybr/three-way comparison and ask Claude to challenge the proposed focus exceptions, correction rendering, warning placement, practice-result priority and concise daily loop against current screenshots and L's mechanism limits. Select relevant interaction lessons, not a visual clone or a requirement to copy every competitor feature.
- Run Architect then Critic sequentially against the integrated artifacts. Record unresolved disagreements and quality-gate results. If evidence remains unavailable, narrow the approved scope explicitly rather than describing the whole critique as complete.

**Acceptance:** each material recommendation has an observed/source basis or an explicit hypothesis label; the planned fix has a counterexample test; no missing report is presented as passed. Consensus artifacts remain local review evidence, not execution authority.

### Stage 1 — Primary UI/UX track: a coherent daily-practice experience (P1–P4)

**Resources:** `app.ts`, `style.css`, existing app/browser tests; a small preferences helper only if necessary; update `DESIGN.md` after Claude settles presentation. No scoring rewrite, new model or database migration is required for this stage.

This stage is an independently valuable product increment: ready entry, focused typing, understandable results, one-action continuation and a meaningful return view. Complete and review that whole journey, rather than shipping isolated visual tweaks while waiting for ML. Actual Claude owns hierarchy, typography/spacing, interaction presentation and visual acceptance. Use the forthcoming three-way comparison to finalize the experience criteria; preserve TypeForge's quiet identity and local-first strengths.

**AC1 — Preferences and focus.** Remember duration, explicit keyboard declaration and practice kind/manual pair locally in a versioned validated preference record. Use valid explicit URL values first, then a valid origin's settings for lineage-bearing links, then remembered values for ordinary entry, then defaults. Invalid explicit values retain the existing explained safe fallback rather than silently inheriting a preference. Unsupported/stale manual choices fall back visibly to General. Failed/unavailable preference storage does not block typing or result saving. Reset restores defaults. Preferences never infer a QWERTY declaration that the user did not make.

On intentional ready-practice entry/repeat, input is focusable without traversing navigation; clicking blank surface space focuses the native input. If a user has moved focus to a control, preserve it and show a clear focus-recovery affordance. No key stealing from controls/composition/modifier shortcuts. Do not start a run before an accepted text insertion.

**AC2 — Readable running state.** Apply the compact ready/running hierarchy from Claude's approved direction. At 1440×900 and 390×844, place the active line at or above the review's 45%-of-viewport target; at 320 px and 200% real browser zoom, it must become visible on focus without manual page scrolling. These are proposed product acceptance targets, not research thresholds. Ordinary corpus words that fit a line must not split mid-word. Native textarea and mirror still agree for middle insertion, Backspace, Ctrl+Backspace, selection replacement, wrapping and caret position. Error state must not depend on hue alone. Run-critical warnings must appear adjacent to the active line and within the viewport; no instruction reflow on every edit.

**AC3 — Repeat and lineage.** A General, Manual or Recommended practice result has an immediate repeat action preserving duration/layout/mode and manual choice or freshly revalidated recommendation. A documented keyboard action invokes it without stealing focus from other result controls. No-origin practice does not mention deletion or a failed comparison. A genuinely missing/unreadable/incompatible/exhausted origin still explains why retest is unavailable. Existing valid fresh-retest exclusions remain unchanged. The primary metrics and next action fit the desktop result viewport; full diagnostics/export/delete remain accessible.

**AC4 — Meaningful reflection without invented progress.** Show actual session accuracy/pace and at most one supported observation, with a useful next action. Sparse timing is explicitly insufficient for comparison; do not rank a single interval as a weakness. Keep model IDs/prediction detail in inspectable secondary content, preserving provenance. Progress summarizes completed practice sessions and their recorded elapsed time separately from eligible compatible assessment trends. Because current elapsed time includes focus-loss time, label it session time, not active time; omit or separately label flagged runs in activity totals. No streak, account, notification or efficacy claim is required. Calendar aggregation uses the browser's current local timezone and is documented; deletion recomputes displayed totals.

**Expected benefit:** fewer steps, truthful feedback and a coherent repeat loop are directly testable. Increased enjoyment and return frequency are plausible but require user observation; faster typing is not a Stage 1 completion claim.

**UX/adoption evidence:** capture before/after journeys at the same viewports and count actions to first accepted typing and repeat. A small voluntary usability round should assess unprompted task completion, interpretation of errors/results, perceived friction and willingness to return; report observations rather than treating a handful of users as a population retention estimate. Recruitment is not a gate on truthful local defect repair. Record separately what Claude/automation verified and what humans actually experienced.

### Stage 2 — Make practice inform the next block (P5–P6)

**Dependency:** Stage 0 ML/engineering reconciliation and Stage 1 stable journeys. **Resources:** `profile.ts`, `corpus.ts`, `model.ts` boundaries, `app.ts` integration, `engine.ts` session types and `storage.ts` validation only where the finalized provenance contract requires it. Prefer pure functions and derived data over a second persisted source of truth.

**AC5 — Separate practice profile.** Preserve `selectHistory`/assessment compatibility and frozen prediction behavior. Introduce a distinct practice-profile version with source result IDs, settings bucket, observation dates and separate clean-timing/error-opportunity aggregates. Rebuild it from validated saved practice records between blocks; do not mutate historical result JSON or serialize/recompute history per keystroke. Profile freshness/window limits are named configuration values and must be fixed with the ML reviewer before implementation; no scientifically optimal threshold is claimed. Initially keep duration/layout/language/corpus/input-mode buckets separate rather than silently pooling them. If no current supported profile exists, General remains ready and useful.

Only eligible clean timing contributes to its timing aggregate. Corrected mistakes can contribute to the separate expected-key error-rate evidence when diagnostics are valid. Unsupported/composition/invalid diagnostics cannot become a confident suggestion. Reopening, deleting, resetting or clearing source records changes the next profile/suggestion, not a running block's frozen snapshot. Failure to read history falls back safely without blocking practice or inventing a focus. No new collection of raw physical-key streams or private writing is needed.

**AC6 — Policy and dose contract.** Define coaching policy separately from the artifact's predictive baseline selection. A suggestion records the policy version, signal used, support/opportunity count, reason and fallback; it must not claim trainability or recoverable WPM. Retain General as default and Manual as a user choice. Start with existing supported timing hypotheses or a separately specified simple error policy; do not implement both by assumption. The ML/learning reconciliation must select the first policy, eligibility/stability/freshness settings, and how its provenance fits strict stored-result validation before this stage is execution-ready.

For every supported pair, compare expected target opportunities per 100 characters with General and report unique word/passage contexts and repeats. A policy labelled “targeted” must enrich the target by its declared measure or explicitly fall back/relabel; the target-free third passage is not a requirement. Check realized exposure for completed and partial short runs; never equate an expected full-cycle rate with what a user received. Do not expand the corpus or reduce support gates merely to hide inadequate coverage. Use the simplest sampler that meets the agreed exposure/context contract.

**Expected benefit:** the product becomes responsive to practice and its targeting label becomes mechanically defensible. Whether the suggestion is helpful, motivating or more effective than varied General practice is a separate hypothesis. The corrected loop can use a heuristic; showing Ridge in the loop is not an acceptance criterion.

### Stage 3 — Evaluate added value and only then broaden ML/content (P7/P9)

**Dependency:** a reliable daily-practice slice and a frozen policy specification. **Resources:** learning/ML evaluation protocol, protected task banks and the existing offline experiment as a separate artifact. No study is started by this plan.

- First test task completion, result comprehension and reasons to return. Then assess real recommendation coverage and stability from all consenting starts, including fallbacks—not just successfully targeted users.
- Compare varied General, a simple error policy and the chosen timing policy with matched time/feedback before treating a learned selector as necessary. A learned challenger must improve the decision metric chosen in advance, then demonstrate any claimed retained/held-out typing benefit. Lower interval MAE alone does not meet that gate.
- Preserve the frozen public-data experiment. New product-study outcomes/texts must not feed policy tuning or the practice profile when designated as protected probes. New task packs receive explicit corpus/metric compatibility rules; do not pool lowercase copy scores with punctuation, coding or composition scores.
- Human sample size, recruitment, retention interval, worthwhile-effect threshold and export consent are future study decisions. They do not block shipping truthful Stage 1 polish or a clearly experimental Stage 2 profile. The learning report's illustrative sample sizes are not commitments or powered efficacy designs.

**Expected benefit:** evidence can tell Owen whether personalization adds value and which capability merits further effort. Even a negative result is useful if the product keeps a better, simpler General-practice experience.

## 5. Cross-cutting invariants and risk controls

| Risk | Boundary / mitigation |
|---|---|
| A prettier surface breaks native edits or caret alignment | Keep native textarea ownership; match mirror geometry; real keyboard-path regressions before replacing the error representation; retain current rendering if a proposed alternative fails |
| Preferences contaminate retest or fabricate keyboard support | Explicit precedence, validation and lineage checks; remembered declaration comes only from an explicit user action |
| Practice adaptation silently changes benchmark meaning | Separate practice profile/version and evaluation history; immutable old records/predictions; preserve duration/mode/corpus compatibility |
| Derived profiles survive deletion or overfit stale history | Rebuild from valid source IDs, version/freshness checks, delete/reset and cross-tab next-block tests; no in-flight snapshot mutation |
| A focus is statistically sparse or delivers too little practice | Report denominators/context coverage; general fallback; policy stability and actual exposure checks; no unsupported diagnosis |
| New summaries add latency or whole-history work to each keystroke | Compute at block/page boundaries; retain bounded engine; compare input timing traces and large-history behavior with the same environment baseline |
| Accessibility claims outrun automation | Claude owns presentation; engineering checks semantics; actual screen-reader/IME/Firefox/Safari/physical-device checks remain explicitly unproved until exercised |
| “More useful” becomes a causal learning claim | Separate mechanics, usability, coverage, retention and transfer evidence; no numerical benefit marketing from script WPM or Ridge MAE |
| Privacy changes under the banner of evaluation | Local by default; no telemetry/upload/account work in near-term scope; later opt-in protocol minimizes data and permits ordinary local use without enrollment |

## 6. Work allocation and dependencies

This is future staffing guidance, not an execution launch. After the coordinator finishes review and obtains the appropriate execution handoff:

- **Actual Claude, capable model/high effort:** own ready/running/results/progress design and visual acceptance, including any revision to `DESIGN.md`. Use the already evidenced direction; do not commission a theme replacement.
- **Executor, capable model/medium-to-high effort:** one owner for `app.ts`/`style.css` integration, preferences and navigation. Keep geometry/input changes in the same lane to avoid conflicting edits.
- **ML/evaluation specialist, capable model/high effort:** own the Stage 2 policy/provenance contract and bounded hypothesis checks; no automatic model training.
- **Executor, capable model/high effort:** own pure profile/sampler changes after the policy contract is fixed. Can work in parallel with UI only on disjoint files/interfaces; one integration owner resolves `app.ts`.
- **Test-engineer/verifier:** medium effort for established mechanical checks, high when failures cross input/storage boundaries. Independent review verifies the complete user journey and historical compatibility. Coordinator owns final evidence and scope claims.

Use native role-routed subtasks for bounded future slices and Orca for actual Claude or separate workspace needs. `omx team`/durable goal execution needs a supported attached runtime; it is not available merely because this App planning surface has artifacts. No model/global setting changes are implied. The coordinator remains on Owen's selected model.

Dependency order: evidence integration/challenge → Stage 1 → profile/policy contract → Stage 2 → optional study/content/model expansion. P6's demonstrated dose bug can be corrected as a bounded existing-feature improvement once the sampler contract is settled; it does not require human efficacy proof. P8 findings can move a proven reliability defect earlier.

### Engineering and Git discipline for later execution

- Inspect `git status` before each slice; assign one owner per shared source file and preserve unrelated work. Use Orca-created isolated workspaces only when parallel writes/builds actually conflict.
- Track source, tests, plan/review decisions and bounded reproducible evidence in meaningful local commits. Suggested boundaries are preferences/focus, result continuation, typing-layout/correction, practice summaries, profile contract, then sampler/policy. Keep planning-only changes distinguishable from behavior changes. Do not stage another lane's unfinished work or commit private data/credentials.
- For behavioral fixes, add a regression that exposes the defect before changing implementation when existing coverage does not already protect it. Follow with the smallest change, targeted tests and fresh type/build/browser checks appropriate to the affected contract. Tests must exercise behavior, not just mirror implementation text.
- Prefer current utilities and platform APIs; no new dependencies without a demonstrated need and authorization. Do not refactor the entire app during a focused UX fix.
- Preserve legacy fixtures, strict result validation, caps, failure recovery and native-input tests. Use reviewable diffs and `git diff --check`; record absent lint tooling honestly rather than inventing a passing lint command.
- Stage rollout locally: prove one complete increment, review its UI and engineering evidence, then widen. Do not bundle UI redesign, data-schema migration and model promotion into one release. Production deployment remains a separate authorized action.
- The lead integrates and verifies; an independent reviewer checks the combined result before completion is claimed. Commit messages and review artifacts explain user-facing behavior and validation, with failures/limitations retained.

## 7. Decisions and stop conditions

Most defaults are reversible recommendations, not questions for Owen. Prioritize daily practice, keep General available, remember explicit preferences, keep assessment/ML inspection accessible, avoid punitive streaks, and retain current narrow task claims.

Only materially branching choices remain for later resolution:

1. Whether touch typing on phone keyboards or a beginner course is a near-term supported audience expansion. Default here: physical-keyboard copy practice with responsive viewing; do not claim tested mobile/IME support.
2. Whether and when to recruit a consented learning study, with its practical capacity and worthwhile-effect threshold. No study is necessary to complete the present review or ordinary polish.

Technical decisions required from the pending reviewers, not Owen: profile freshness/window and support policy; policy provenance under strict result validation; concrete engineering defects and performance baseline; any verified ML evaluation limitations.

**Current stop condition:** this Planner draft is complete when the problem/fix/benefit mapping and test specification are written with missing evidence explicit. The coordinator then integrates reports and Claude's design challenge, obtains sequential Architect then Critic review, and records final dispositions. No implementation, deployment or data collection follows from this draft. If final evidence cannot support a later stage, approve only the smaller grounded stage and preserve the unresolved branch.
