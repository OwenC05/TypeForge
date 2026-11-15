# Claude clarifications addendum: wrapping, error cue, run-visible exceptions, combined benefit

Status: planning only, 15 November 2026. Actual Claude design lane. No browser run, prototype, source edit or new agent.

This addendum is in addition to `.omx/plans/typeforge-claude-benefit-review.md`. That file is left unedited; where they differ, this addendum supersedes it.

**Inputs read:**
- My benefit review.
- `docs/reviews/2026-11-15/engineering-review.md` (E1–E6).
- `docs/reviews/2026-11-15/ml-review.md` (ML-01–ML-11; currently untracked in the worktree).
- `.omx/plans/typeforge-reconciled-findings.md` (R01–R15).

**Receipt:**
- Provider and model: Anthropic Claude `claude-opus-5-5`, as stated by the session context.
- Effort: inherited; actually-applied effort unknown.

## 0. Provenance correction (coordinator `msg_8da8a82f0513`)

My benefit review (§0) gave sha256 prefixes `f956f7b9202c3348` (PRD) and `20f5c29ab41be385` (test spec). **Treat those prefixes as erroneous or unverified.** I cannot reproduce them or show which bytes they were computed from, so they were never independent proof of exact bytes. A faulty truncation pipeline is the likely cause, but I have not verified that.

I recomputed both files now, from the working tree, from `git show b9a2fb9:` and from `HEAD`. All three sources agree:

| File | sha256 |
|---|---|
| PRD | `53dbe1cc6749e6f4e654455e28a81815c2328a2a41e567b8f42825a954d7b70e` |
| Test spec | `40850bfc9a42d7050127e3d2ec46fb829852dc25ce505caea04a433adf3f47d9` |

These match the Architect's and coordinator's values. The substantive review and the observed browser evidence are unaffected.

## 1. Wrapping (W1): layout only by default; content selection is gated

My W1 phrase, "passage max length per width tier", was ambiguous and is **withdrawn as a default**. Revised rule:

- **Default (layout only).** Viewport may change presentation only:
  - font size within the passage range set in benefit review §3.4;
  - stage width and padding;
  - how many context lines are shown;
  - the wrap mechanism (break-all today, or the W2 tape prototype).

  Viewport must **never** filter, reorder, shorten, substitute or re-weight passages. Prompt selection (`selectPrompts`, `selectDrillPrompts`, retest exclusions) must stay a pure function of mode, lineage, settings and seed, with no layout input.
- **Gated (content selection).** Any width- or device-dependent content choice, for example shorter passages on narrow screens, is a separate prototype. It needs all of the following:
  - its own versioned corpus or flow identifier, recorded in the result settings so that it forms its own compatibility bucket;
  - **practice only** at first. Never assessment, unless a separate decision accepts the change in comparability;
  - its own exposure and context accounting under R06, because shorter passages change target dose and repeats.
- **Why.** Content filtered by viewport would silently change corpus coverage, target dose and assessment comparability across devices. That conflicts with R06, ML-03, ML-08 and frozen assessment comparisons.

**Acceptance (automated):**
- For the same seed and lineage, the prompt IDs and their order are byte-identical at 320, 390 and 1440 px.
- Saved result settings and `corpusVersion` do not vary with viewport.
- Dose and exposure reports (R06) are computed without layout inputs.

When a passage does not fit on one line, it wraps under the current geometry-safe mechanism. Fitting on one line is a consequence of layout, not a goal reached by changing content.

## 2. Error cue rule

A caret-anchored cue cannot always point at the first mismatch: after the user types far beyond an error, the two can sit on different lines, or the mismatch can be scrolled out of view. Rule:

1. **The mismatch marker is anchored at the first unresolved mismatch, not at the caret.**
   - "First unresolved mismatch" means the lowest index in the current passage where typed ≠ target, or where an extra character is present.
   - The marker shows the expected character as a small out-of-flow label (`position:absolute`, `pointer-events:none`), placed above or below that glyph. This keeps it on the mismatch's own line, so its position is always right regardless of where the caret is.
   - Only the first mismatch is labelled. Later mismatches keep the existing underline and tint only.
2. **A caret-side pointer appears only when it is needed, decided by geometry rather than character distance.** It shows when the first-mismatch marker is not on the caret's visual line box, or is not inside the visible stage area. It is a compact glyph near the caret with a short text equivalent, e.g. "↶ earlier error: expected e".
   - It disappears once the first mismatch is resolved, or once the mismatch and caret share a visible line.
   - No numeric distance threshold is used.
3. **Backspace guidance stays truthful.** The cue never promises a single-key fix. The existing contract (Backspace corrects the current passage; committed passages cannot be edited) is unchanged.
4. **On passage commit**, which Space allows even with mistakes:
   - the cue and pointer clear;
   - the committed context line keeps static error underlines, rather than today's uniform grey, so that past mistakes remain visible without any instruction.
5. **Accessibility.**
   - The visual label and pointer are `aria-hidden`.
   - The accessible correction text stays in the input's description, but moves into a region of fixed height (or screen-reader-only text) so it no longer reflows the layout (F5/F6).
   - Announcements follow the §3 slot rules.
6. **Performance.**
   - Marker and pointer positions come from the paint pass that already exists (`app.ts:233-268`), adding no extra layout reads on each keystroke path (E3).
   - Acceptance: when the E3 paired harness is rerun on identical inputs, it shows no regression against its own recorded baseline, with no lost edits. I set no new numeric budget here.

**Acceptance (geometry and screenshots):**
- The expected glyph is rendered on the mismatch's own line in these cases: a substitution, an extra character, a mismatch at a line edge, a mismatch scrolled out of view, and a caret several lines past the mismatch.
- The pointer appears exactly in the "not same line or not visible" cases.
- The native selection and caret tests, and the W2/§5.4 wrapping cases, pass unchanged.

## 3. What is visible during a run, and the essential exceptions

The baseline remains: the stage, a mini timer and a restart affordance. Only the following exceptions are allowed. All live in **one reserved feedback slot** of fixed height, attached to the stage, so nothing reflows the active line. Exceptions 4 and 5 are separate control and caption elements.

| # | Exception | When | Persistence | Why it is essential |
|---|---|---|---|---|
| 1 | **Integrity notice**: the run is now flagged and excluded from headline progress | Blur or visibility interruption, unsupported edit, composition reconciled as unsupported | Stays until the run ends; the result repeats it | Assessment validity must not change silently (R03, F7). This is honest notice; the interruption semantics are unchanged. |
| 2 | **Native Undo/Redo notice** (E2/R08) | The first `historyUndo` or `historyRedo` in a run | Stays until the run ends | Today this silently turns the whole run into `invalid-input` with `accuracy: null` and excludes it. Until R08 defines the semantics, the user must learn this at the moment it happens, e.g. "Undo isn't scored: this run will be saved without accuracy and excluded from progress. Restart to keep scoring." Once R08 changes the semantics, the copy must change with it. The notice must never imply that the old behaviour has changed. |
| 3 | **Transient input hints** | Enter no-op; paste or drop rejected | Cleared at the next accepted insertion | Explains why a key did nothing. |
| 4 | **Focus-recovery control** | The input loses focus during a run | Until focus is restored | A real button, "Continue typing (Enter)" (benefit review §5.1), together with notice #1 where it applies. |
| 5 | **Block identity caption** | Always, at low visual weight | Static | A single line such as "General" / "Manual: th" / "Suggested: th — why?". The user must be able to see what they are practising. It is not a metric. |

Slot rules:
- Integrity notices (#1, #2) take priority over transient hints.
- The newest message of equal priority replaces the older one.
- The slot is a polite live region announced **once per message change**, never per keystroke or timer tick.
- Live WPM/accuracy and explanatory paragraphs stay hidden during a run (benefit review §6 defaults).

**Thin or roundoff-only evidence** (ML-04, R07, ML-03, ML-05):
- **Before the run (ready state and practice-state strip).** A "Suggested" focus is shown only if the coaching policy returns a target together with its support statement (observations, contexts, policy version). If the policy abstains, shows General with a short reason ("Not enough evidence for a focus yet"). This covers uniform or no-effect histories that pass today's `score > 0` gate only through floating-point residue, and fallback after a coupled-artifact failure. The UI never labels an abstained or roundoff-only result as a weakness. Choosing the policy's minimum effect is the ML and learning lanes' decision; I set no threshold here.
- **During the run.** No evidence detail. Only caption #5 and its "why?" link, which is inert while typing and opens after the run.
- **Results.** A target's support is shown only behind the disclosure, with denominators. Single-observation pairs are never ranked (F8).

**Acceptance:**
- A screenshot per exception state shows that the slot is in the viewport and adjacent to the stage, and that the stage box is unchanged (layout shift = 0 across the event).
- A synthetic uniform-history fixture renders General with the abstention reason and no target label.
- An Undo fixture shows notice #2 in the run, and the same consequence on the result page.

## 4. Bounded challenge: how the combined fixes improve UI/UX and usefulness

**What the combination plausibly delivers.** This is mechanism, verifiable by checks:
- Entry and repeat need fewer steps (R01–R02).
- The text being typed becomes the dominant, stable object (R03).
- The feedback stays truthful at the moment it matters: errors, interruptions, Undo, thin evidence (§2, §3, R08, ML-04).
- Practice activity becomes visible as observed facts (R09).
- Remembered deliberate settings also reduce accidental evidence fragmentation across duration and QWERTY buckets (ML-08). That improves both UX and the consistency of future practice evidence, without pooling assessments.

**Interactions that could cancel the gains**, each with its guard:
- Hiding chrome could hide integrity information. Guard: the §3 slot.
- Remembered settings could override lineage. Guard: precedence of explicit URL value, then origin, then remembered value, then default (PRD AC1).
- "Again" could blur assessment validity. Guard: practice only (benefit review §5.2).
- New stage UI on the keystroke path could worsen constrained-CPU input (E3). Guard: reuse the existing paint pass; no regression on the rerun harness.
- An activity summary over unbounded history could delay pages (E4/R11). Guard: compute in bounded pages, off the typing path. Typing never waits for the summary.
- Flagged and Undo runs in activity totals: count them as session time, labelled as excluded or flagged, so totals stay truthful.

**What the combination cannot claim:**
- Any learning, speed or retention gain.
- Any increase in return frequency or enjoyment. Those remain user-test hypotheses (U).
- Accessibility or IME success. Those need real assistive-technology and device tests (D).
- Superiority over Monkeytype or Keybr beyond the flows exercised.

**Verdict.** The combined fixes are justified as **UX and usefulness corrections with mechanical acceptance**. They are useful independently of ML, and they remove three classes of silent dishonesty in the current UI:
- hidden interruption flags;
- silent Undo invalidation;
- noise-level "focus".

Design ownership stays with actual Claude. Engineering owns the R08 semantics and the E3 measurements; the ML and learning lanes own the coaching-policy thresholds.

## 5. Exact revisions requested

1. **PRD AC2 / test spec V2.** Add the §1 layout-only rule and the content-selection gate (versioned bucket, practice only, R06 accounting), with the byte-identical prompt-ID acceptance across 320/390/1440 px. Remove any reading of W1 as width-dependent content.
2. **PRD AC2 / V2.** Replace "the expected character is visible within 1 line-height of the caret" (benefit review §5.3) with the §2 rule:
   - the marker is anchored at the first mismatch;
   - a caret-side pointer appears only when the marker is not on the caret's visual line or not visible;
   - committed lines keep static error marks;
   - the existing paint pass is reused, with E3 non-regression.
3. **PRD AC2 / AC3 and V2/V3.** Define the run-visible set as stage, mini timer and restart, plus the five §3 exceptions in a single reserved slot. Make the Undo notice mandatory until R08 resolves the semantics, then update the copy to match. Add the slot-priority and announce-once rules.
4. **PRD AC4–AC6 / V4–V6.** Before showing any "Suggested" label, the UI requires a policy target with a support statement. Abstention renders General with a reason. Add a uniform-history fixture (ML-04) and an artifact-fallback fixture (ML-05) as UI cases. Thresholds remain an ML and learning decision.
5. **Benefit review provenance.** Replace §0's prefixes with the §0 digests above, marking the old prefixes erroneous or unverified. The original file stays unedited; this addendum records the correction.
6. **Unchanged.** Native textarea ownership and editing contracts, assessment interruption and validity semantics, frozen benchmark history, no learning claims, no implementation authorisation.
