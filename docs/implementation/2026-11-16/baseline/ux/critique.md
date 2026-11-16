# Critique and state inventory of the accepted UI, for the baseline flow

Actual Claude P2, 16 November 2026. Inputs: accepted captures `docs/implementation/2026-11-15/direct-practice/evidence/screenshots/` at `db56cf0` (for example `390-14-insufficient-evidence.png` and `1440-01-ready-focused-first-visit.png`), `typing-app/client/src/app.ts` at `c65460b`, and `DESIGN.md`. No fresh inspiration hunt: the accepted references R1–R5 in `direct-practice/direction.md` still govern.

## What already works and must not move

- `/` is the practice surface: focused native textarea, General 30 s, and the first key starts the run. Remembered duration/kind/pair.
- One rail row of keys. One reserved slot of fixed height. Results in place, with a focused primary key so Enter continues.
- The failed-save row (vermilion-deep rule, retry/export), and unsaved results carried and never blocking.
- Paper/ink/cobalt/vermilion roles. Colour carries state only.

## Deficits that touch the baseline (observed)

| # | Deficit | Evidence | Consequence for this lane |
|---|---|---|---|
| B1 | The locked `suggested` item is `disabled`, so it can't be focused, and arrows skip it. The explanation fires only on `pointerdown` (`app.ts:737`). | `app.ts:207`, `:737` | Keyboard and AT users never learn why it is off or how to change that. Fixed in the proposal with `aria-disabled` + `valuechange.preventDefault()`, a documented ui-sdk API. |
| B2 | The `why?` panel is a pile of internal phrases: "Recommended unavailable: No compatible eligible assessment timing history yet. Using General practice. General practice · no supported targeted focus selected." The reason repeats, the word changes from "recommended" to "suggested", and it never says what to do next. | `390-14-insufficient-evidence.png`; `app.ts:51-55, 224-231` | Replaced by one baseline block with plain sentences and a single action. |
| B3 | Suggested availability depends on the newest ten assessment *sentences*, which is invisible to the person. No count and no path exist. | `profile.ts:28-31` | The new milestone is visible and witness-derived. The ten-sentence calibration stays as it is and is never shown as baseline progress (P1). |
| B4 | The assessment result's primary action is "practice next", with no notion of a series. | `1440-13-assessment-result.png` | During the baseline the primary becomes **next test ↵**. After it, the existing assessment actions return unchanged. |
| B5 | Under forced colours, selected keys and typed-vs-untyped text disappear (P4 F-1/F-2). | P4 release captures | Repaired separately (`forced-colors-acceptance.md`). The baseline CSS adds forced-colour rules for its tally and progress. |

## Risks I designed against

- **Level/game reading.** A 10-segment tally can look like XP. Mitigations: no tally at 0 and none after 10 (it disappears instead of celebrating), no colour other than ink, the word "tests" always beside the number, nothing ever subtracts for mistakes, and no streaks, goals or congratulation copy.
- **Promise inflation.** "Unlock" never appears. The copy says "can look for a focus". Ending with no focus is presented as complete.
- **Second hidden threshold.** The coach's 20-run/30-day window never appears as a number (contract §6 C5).
- **Interrupting first-key readiness.** No baseline element takes focus on `/` or on the assessment page, and nothing intercepts keys.
- **Slot overflow.** Every press message is ≤ ~75 characters plus one small key, measured to fit 320 px without scrolling (`evidence/states.json`, `slotClipped=false` everywhere).

## Open design questions (for root or a later usability pass, not decided here)

1. Will the hairline tally inside `suggested` be read as progress or as an underline? It is redundant with text in `why?`, so removing it costs only glanceability. The independent critique below gives a second opinion.
2. Should the baseline summary (C1) appear on the Progress page as well as the final result?
3. Human comprehension of "baseline test" vs "assessment": no user observation exists, and none is claimed.
