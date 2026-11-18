# Finite Suggested plan: visible end-of-plan contract

18 November 2026 · actual Claude (`claude-opus-5-5`, requested effort high) · Task `task_8e97696fc3b6`, Dispatch `ctx_4c524f70c8b9`. Requested by root in `msg_22b78999d17a`; the direction was proposed in `msg_ee608c3c32ab` and root selected it in `msg_f91b55107ad8`.

**Scope.** This file covers the visible experience only. P1 r2 owns the engine adapter, the timing and result semantics, metric validity and source eligibility. Nothing here accepts that adapter, and no production file changes. The certified `he/in/le/th` plans run to 480–502 characters, so a fast typist, or anyone at 60 s or 120 s, can reach the end before the timer does. The current engine wraps back to the first prompt at that point (`engine.ts:164,201–203`). The pilot must not do that.

## Rules

1. **The timer is an upper bound.** The ready label is unchanged: `Suggested practice · th · 60 s`. Nothing is added before the first key. General, pair, duration and qwerty keep working exactly as before.
2. **No wrap.** While the last certified sentence is active, the next-passage context line (`#next-prompt`, aria-hidden) reads `— end of this block —`. A running block never changes its label, slot or focus (contract rule 3).
3. **The block ends immediately when the last sentence is submitted.** The engine reports a distinct **plan-exhausted** outcome. It is not a timeout, and the timer is not held. The result appears in place, as every result does today.
4. **The result label states what happened**: `Suggested practice · th · all N sentences done at T s of D`. T is the actual elapsed seconds and D is the chosen duration. It is never `D s · complete`, and nothing calls it a completed 30-second run.
5. **Observation line:** *That’s every sentence in this th block, so it ended before the timer. The next suggested block uses the same small set of sentences.* There is no dose, exposure, "th came up n times" or improvement line (C3).
6. **Figures are conditional, and unavailable by default.** The WPM/accuracy row is omitted until P1 r2 confirms that the existing metrics are valid over the actual elapsed time for a plan-exhausted result. If P1 does confirm it, the row returns with the caption *over the T s typed*. The formula never changes for this case.
7. **What it counts toward** (clarified for root, `msg_025112f453c8`). Two separate exclusions apply, for two different reasons:
   - **All practice**, early or not, is excluded from the assessment baseline and the newest-ten medians. That exclusion comes from practice purpose.
   - **The early plan-exhausted outcome** is additionally excluded from completed-30 s coach sources. That exclusion comes from the early end, not from practice purpose. Ordinary eligible practice that reaches the timer remains an input to the next coach window, as before.

   Root currently excludes early plan-exhausted results from coach evidence. Any broader future eligibility needs a separately reviewed policy. No baseline copy appears on this result, and the UI makes no claim about coach eligibility either way.
8. **Actions:** the primary is **suggested again ↵** (it honestly repeats the same sentences, as line 5 says) and the secondary is **general**. Focus goes to the primary, and Enter acts only on it. The accepted save/retry/export row and details are unchanged.
9. **Timer first:** if the timer expires before the plan ends, the result is the ordinary practice result. No new state is added.
10. **Interruption** (focus loss, restart or safety stop) before the end follows the existing flagged/aborted semantics.

## Needed from P1 r2 (not decided here)

- A plan-exhausted completion that is distinct from timeout, together with actual `elapsedMs`, the number of sentences in the plan and the pair.
- A ruling on whether the existing WPM/accuracy values are valid for an early end. That ruling decides rule 6.
- Source eligibility for coach evidence, if any. It is never baseline or summary eligibility.

## Prototype and regression

The prototype has state `37-practice-plan-end` (`prototype/fixtures.ts`, `finitePlan` stand-in, `plan=finite`). The named regression `REG-9` (`evidence/scripts/regressions.mjs`) types the whole plan and checks four things: the block completes at the last sentence, the label reads `all N sentences`, the label never reads `60 s · complete`, and no baseline copy appears. These are fixture checks of the visible contract. They are not proof of the engine adapter, and they are not human comprehension evidence.
