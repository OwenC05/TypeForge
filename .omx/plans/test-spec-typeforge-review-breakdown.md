# TypeForge review breakdown: acceptance and verification specification

**Status: Planner draft, 15 November 2026.** Companion to `prd-typeforge-review-breakdown.md`. These are future verification requirements, not claims that changes exist or have passed. Source baseline: `de69444a6201da96281ca9ad88088904477775a2`.

## Evidence receipt required for final planning

| Evidence | Available now | Required treatment |
|---|---|---|
| Claude design review, current screenshots and Monkeytype matrix | Yes: `docs/reviews/2026-11-15/design-review.md` and `design-evidence/` | Preserve limitations; obtain Claude's focused challenge of proposed solutions |
| Claude Keybr comparison and UX benefit challenge | Pending: `.omx/plans/typeforge-claude-benefit-review.md` | Integrate actual live/source evidence into a three-way matrix; no inferred Keybr behavior or non-Claude design verdicts |
| Independent learning review and source probes | Yes: `learning-review.md`, `learning-evidence/source-probe.json`, 43 passing targeted source tests | Synthetic exposure/count gates are not human recommendation coverage or skill gains |
| Independent ML review | Pending | Reconcile actual model/policy path, evaluation, artifact/fallback behavior and policy contract before final Stage 2/3 recommendations |
| Independent engineering review and fresh checks | Pending | Incorporate actual defects and test/performance/privacy gaps; do not treat historical checks as current passes |
| Sequential Architect → Critic review | Not yet | Full task, context, both planning artifacts and completed preceding review required; revise/re-review on nonapproval |
| Configured Ralplan quality gates | Coordinator intake reported none | Recheck catalog at the required workflow step; do not invent a configured gate |

## Verification matrix

### V1 — Ready entry, preferences and keyboard focus (AC1 / P1)

Fixtures: first visit; return after 15-second declared-QWERTY General; Manual valid/stale pair; Recommended newly unavailable; explicit URL override; valid retest origin; invalid URL; absent/corrupt/blocked preference storage; reset.

Pass requirements:

- Ordinary return restores validated duration/declaration/practice choice; explicit URL and lineage inherit with the plan's precedence. Invalid values visibly fall back safely.
- No declaration is inferred from a prior undeclared result or device guess. Clearing preference state does not delete results; clearing results does not silently create a declaration.
- Intentional ready-practice/repeat offers immediate native input focus; blank-surface click focuses it. If focus is already on a control, it stays there.
- Printable keys in the ready input are accepted once; keys on selects/buttons/links/contenteditable or with Ctrl/Alt/Meta/composition are not intercepted. Tab remains navigation; no keyboard trap.
- No clock starts until the first accepted insertion; preference read/write failure does not prevent typing/saving.

Test at pure preference/parser level where possible; use the browser for actual focus/event routing. Existing anchors: `tests/app.test.ts` duration/keyboard/practice parser and restart cases.

### V2 — Typing visibility, correction and interruption (AC2 / P2)

Capture ready, running, first error, corrected error, middle edit, selection, page focus loss, input blur and repeated passages at 1440×900, 390×844 and 320 px. Exercise real browser 200% zoom separately from CSS/viewport approximation.

Pass requirements:

- Active-line location meets the finalized Claude geometry target; focused input stays visible. No ordinary fitting corpus word wraps mid-word; textarea and mirror use equivalent wrapping.
- Backspace, Ctrl+Backspace, Shift+Arrow, click caret placement, insertion in the middle and selection replacement retain accepted text, caret and selection agreement across wraps. Completed passages remain noneditable.
- Wrong/extra input and its expected character remain understandable using Claude's selected representation. If a stable target/extra layer cannot preserve geometry, use the smaller correction-cue alternative rather than weakening editing tests.
- Enter no-op and focus-loss explanations are visible beside the active line. No hidden flag is introduced without visible explanation. Assessment interruption labels/clock and existing scoring remain unchanged.
- Reduced motion and keyboard-visible focus work. Check live-region semantics and record actual screen-reader behavior before claiming speech is fixed; automated accessibility trees alone cannot prove announcement behavior.
- Modified rendering does not serialize full results/history or recompute the profile per keystroke. Capture before/after timing traces on the same device/browser and inspect regressions; no unsupported universal latency target.

Existing anchors: `tests/engine.test.ts`, `tests/app.test.ts` edit/safety-stop cases, `tests/flow-capacity.test.ts`, and `tests/browser/typing-flow.js`.

### V3 — Result continuation and lineage (AC3 / P3)

Matrix: General/Manual/Recommended practice × no origin/valid origin/deleted origin/incompatible origin/exhausted bank, plus flagged result, legacy record and save failure.

Pass requirements:

- Practice's primary next action repeats the mode/settings; Manual retains the chosen supported pair, Recommended revalidates current evidence and explains a General fallback. A deleted record cannot silently remain a source of the next suggestion.
- A never-linked practice result does not mention deleted/unavailable assessment evidence. Real deleted/unreadable/incompatible lineage remains honestly unavailable.
- Existing fresh-retest prompt exclusions include the origin's partial passage. No repeat fix changes score schema or rewrites historical predictions.
- Documented result shortcut works only in its intended context. Export/delete/details remain keyboard reachable. Failed save retains current result and export; permanent validation errors do not offer an impossible retry.

Existing anchors: `tests/app.test.ts` optional-origin/retest/save cases, `tests/profile.test.ts` retest lineage, `tests/storage.test.ts` legacy/strict extensions.

### V4 — Reflection and practice activity (AC4 / P4)

Create known isolated history containing completed practice, interrupted practice, eligible and incompatible assessments, a legacy result and corrupt data. Use a fixed clock/local timezone for date-boundary tests, then explicitly test a timezone change.

Pass requirements:

- Practice is still present in the saved-session table and is now summarized separately. Session count and recorded session-time totals match eligible included records exactly; flagged runs are omitted or separately labelled according to the finalized display contract.
- Assessment trend still uses compatible eligible assessments only. Different duration/layout/corpus/mode buckets do not become one WPM trend.
- Totals recompute after deletion; no stale derived activity survives source deletion. Preference reset and history deletion are distinct operations.
- No one-observation timing is ranked as a weakness. Missing support is stated; version/provenance detail remains accessible without occupying the primary takeaway.
- Claude checks the primary metrics/next-action desktop viewport, narrow layout and comprehension of “observed”, “suggested” and “improved”. Human comprehension is a separate evidence item; script assertions cannot certify it.

### V4b — Whole daily journey and adoption hypothesis (primary UI/UX track)

Use Claude's final three-way TypeForge/Monkeytype/Keybr comparison to select the relevant journey criteria. Preserve competitor version/date and untested paths. Run the same TypeForge before/after route: first visit → ready practice → error/correction → result → repeat → return → activity summary.

- Record actions and time to ready/first accepted typing and repeat, focus recovery, visible feedback, retained settings and result comprehension. Script timings describe automation; human usability observations are reported separately.
- Capture consistent ready/running/results/return screenshots at desktop and narrow widths; actual Claude checks visual hierarchy, typography/spacing, interaction clarity and coherent identity. Avoid claiming parity outside exercised flows.
- Where a small voluntary usability round is feasible, use unprompted tasks and questions before coaching the participant. Record completion, errors, misunderstood feedback, reasons to return or stop and remaining friction. A small sample informs improvements; it cannot certify population retention or typing efficacy.
- UI/UX acceptance is a first-class Stage 1 completion gate, independent of ML novelty. Participant recruitment is not a gate to local defect fixes; missing human evidence limits adoption claims rather than being relabelled as passed.

### V5 — Practice-profile isolation and responsiveness (AC5 / P5)

Before implementation, freeze a `practice-profile-v1` contract with the ML reviewer: admitted result/settings buckets, freshness/window constants, error/timing denominators, unsupported-input exclusions, policy snapshot, recomputation and deletion rules. No Stage 2 execution-ready claim until these are explicit.

Required synthetic tests:

1. Two completed practice blocks with contrasting supported evidence alter the next derived profile and, where the chosen policy warrants it, the next suggestion. They do not change an already running block.
2. A corrected-error example contributes valid expected-key opportunities/errors but contributes no clean timing from its edited sentence. A long-gap example omits the invalid pair without pretending the entire sentence was ineligible if existing rules retain it.
3. Sparse, stale, unsupported and conflicting evidence yields a useful explained General fallback. No fabricated counts or “mastered” label.
4. Duration/layout/language/corpus/input-mode differences remain isolated. Frozen assessment `selectHistory`, legacy interpretation, model parity and original prediction payloads are unchanged.
5. Reading, deleting and clearing source results rebuilds the next profile; corrupt records are skipped with diagnostics, not repaired by guessing. Cross-tab deletion leaves the active block's snapshot intact and affects its next restart/block.
6. Profile calculation occurs between blocks/page entry from validated records; failures do not block basic practice. Any additional stored metadata must pass a reviewed strict version/validation contract; no unknown-field bypass.

Use `tests/profile.test.ts`, `tests/app.test.ts`, `tests/storage.test.ts`, `tests/model.test.ts`; add only behavior-level tests needed by the finalized new contract. Historical result fixtures must compare unchanged serialized content before and after derived-profile operations.

### V6 — Honest target exposure and coaching policy (AC6 / P6)

Retain the original read-only `learning-evidence/source-probe.mjs` as baseline evidence. Add implementation tests against the actual revised sampler rather than updating the baseline report to hide the defect.

Required cases:

- All supported manual pairs; common `th`/`he`, sparse `ag`, unsupported pair, empty/corrupt bank and a target present in every passage.
- Expected target occurrences/100 characters and context diversity compared with General using the same bank. Complete cycles, many deterministic seeds and finite sampler output must agree with the declared policy contract.
- Prefix/partial-run exposure at 15/30/60/120-second equivalents, including stopping before the “general” slot. Report realized dose from what was actually presented/typed; do not claim full-cycle guarantees for every short prefix.
- Target enrichment is enforced when promised; otherwise fallback/relabel explicitly. Do not prohibit a target from general passages merely to preserve 2:1 cadence. Adjacent-repeat avoidance and finite capacities continue to hold.
- Changing Ridge coefficients or predictive baseline does not silently alter a separate coaching policy. Missing model artifact must preserve whichever explicitly specified non-model policy/fallback is supported, with no fake “ML” label.
- Recommendation explanations name the signal, evidence quantity and experimental status. Error/timing policy thresholds are fixed before outcome inspection and exercised around each boundary.

Target exposure and policy determinism prove behavior, not learning efficacy.

### V7 — Reliability, privacy and performance (P8)

Incorporate the pending engineering report first. The minimum regression envelope includes storage unavailable/quota, version upgrade/blocked tabs, corruption, delete/reload, result-size/attempt/response caps, incomplete runs, missing model/report, input interruption and loaded-session offline completion. No new offline-reload claim.

For new preferences/profile work, verify no keystroke/result/profile upload by inspecting requests in isolated journeys and the changed source. No remote fonts/inference/new trackers are introduced. Check no sensitive raw text is added to diagnostics by default.

Use fresh production build checks and the committed browser harness. A large-history fixture tests page/profile work outside the keystroke path; compare same-environment baseline, record dataset size and timing distribution, and report failures instead of imposing an invented benchmark claim. Untested OS IME, screen reader, Firefox/Safari and physical-device behavior remain explicit limitations or later release gates according to the actual scope.

### V8 — Later policy/learning evaluation and content (P7/P9)

Keep five separate claims: usability, coverage, proximal task performance, delayed retention and held-out transfer. The learning report proposes a bounded sequence and primary sources; the pending ML audit may refine it.

- Use all consenting starts for coverage denominators, including cold-start/fallback users.
- Compare a common-feedback/time General control with simple error/timing policies before adding a learned selector. Predeclare decision metrics, accuracy guardrails and a participant-level retained outcome before an efficacy study.
- Protected experimental outcomes/texts never enter practice adaptation or policy tuning. Same-text speed gains and public-data interval MAE cannot substitute for held-out transfer.
- Explicit opt-in, data minimization and study scope precede participant export. Illustrative sample sizes are not a power calculation or enrollment authority.
- New content versions do not silently change old scores/cohorts. No generic productivity/coding/multilingual claim follows from lowercase copying.

These later evaluations do not block ordinary defect repair or clearly labelled experimental local practice.

## Commands and execution evidence

Run only after changes are actually authorized; this document does not run them or claim success:

```powershell
# Client root: typing-app/client
npm run check
# This invokes Node tests, TypeScript checking and Vite production build.
# No lint script is configured; report that fact rather than a nonexistent lint pass.

# Repository root, using the existing compatible Python environment if available:
python -m unittest discover -s ml/tests -v
# Run when shared model/inference contracts change or ML reviewer requires it.

# Existing diagnostic source baseline, repository root:
node docs/reviews/2026-11-15/learning-evidence/source-probe.mjs

git diff --check
```

For browser regression follow `typing-app/client/tests/browser/README.md`: build, use an exclusively owned strict preview port (documented default 5183), run `tests/browser/typing-flow.js` through the existing Playwright runner, require `failed: 0` and empty `errors`. If another review owns the port/server, use an isolated adapter with the port change recorded; never kill or steer another lane's helper. Keep helpers hidden on Windows and close only owned processes.

Evidence receipts record commit, changed scope, OS/Node/browser, production vs dev, viewport, URL/port, fixture/seed, real versus accelerated clock, actual failure output and screenshot manifest. Automated key cadence WPM is not human performance. A test pass does not establish a product benefit outside its stated claim.

## Git and regression evidence

For each later behavior-changing slice, record the failing regression or existing protecting test, the minimal fix, the passing rerun and its meaningful commit. Inspect/stage only owned reviewed files; keep unrelated work and unfinished sibling evidence out of the commit. A clean source diff and appropriate tests are required before review, but neither replaces the actual UX check. Use separate commits/increments for UI flow, persistent-profile contracts and policy changes so regressions can be isolated or reverted. Track planning/review dispositions and reproducible evidence without adding private participant data or credentials. No new dependency or production deployment follows from this test specification.

## Completion and handoff

Planning completion requires a coherent problem/fix/benefit mapping, explicit pending audit dispositions, Claude design challenge and sequential Architect/Critic approval with required workflow receipts. The coordinator owns those lifecycle/state operations; this Planner writes only the two planning artifacts.

Future Stage 1 completion requires its acceptance tests and fresh independent visual/technical review. Stage 2 additionally requires the fixed policy/profile contract, deletion/isolation tests and dose evidence. No stage may claim faster typing without the corresponding human retention/transfer evidence. No implementation handoff is authorized by this draft.
