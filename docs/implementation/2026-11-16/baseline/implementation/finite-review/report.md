# Independent finite implementation review — REVISE

18 November 2026. **REVISE the finite technical slice:** the strict validator accepts an impossible submitted sentence with no key accounting after a small coherent aggregate mutation. No failure was found in the sampled real producer traces, atomic endpoint, adapter completed count or deadline precedence. The defect is in source-integrity validation, not a claim that early finite sources currently contaminate coaching evidence.

## Exact scope and provenance

Initial brief pin `6bd969f` was superseded by root message **`msg_c715fe4c5a77`** with **`1d80934f44874441c18d00199879da872b1c92af`**. All E source blobs stay identical. The shared `coach-plan.ts` delta from D commit `337bd4f8b2fef4ab1119df0a7dde9b8da5a00ba4` removes the outer `!Object.isFrozen(value)` condition from `deepFreeze`, so already-frozen parents no longer skip mutable descendants. This one-line shared dependency change was inspected and independently checked; the full D policy was not audited.

E commits are `fb2781b53e0d5b77c7df1a5d2106a48ecdeca50f` and `f88e3134d690c6bbb05fb81bd6e045265d4f7860`, imported in root as `4dbb9ea`/`aa94fca`. Relevant production blobs:

| File under `typing-app/client/src/` | Frozen Git blob |
| --- | --- |
| engine.ts | `49191b896c27a5381ca2cbfa6c366221cd5820fe` |
| finite-practice.ts | `727e469d0f24edc8d52e1029aae461988e20dbc0` |
| finite-practice-result.ts | `ac03b966e1e725611334050af0ffc19bde4940c4` |

[results.json](results.json) records the complete reviewed dependency manifest, raw and LF-normalized SHA256, exact Git blobs, root HEAD before/after, and source changes outside the reviewed dependency set. Root HEAD has advanced past the pin in `coach-policy.ts`; that file is outside this finite review and is not imported by the finite modules. Every imported/reviewed producer, adapter, validator, plan/config/corpus/type dependency matches the pin before and after the probe. Unrelated root skill/config changes are untouched. No root source, worktree branch, dependency, build directory or service was modified.

The accepted `policy/finite-adapter-r2.md`, `lifecycle-r2.md` and promoted `coach-types.ts` source boundary was read alongside E's `implementation/finite/report.md`. Prior C2 producer evidence stays frozen. Actual Claude owns all visible end/flag/figure behavior; C/D/F remain separate implementation/integration dependencies.

## Runnable reproduction

From this review worktree:

```text
node --check docs/implementation/2026-11-16/baseline/implementation/finite-review/probe.mjs
node docs/implementation/2026-11-16/baseline/implementation/finite-review/probe.mjs C:/Users/Owenc/orca/workspaces/TypeForge/typeforge-daily-practice
```

The source-root argument is required. The runner imports actual root production modules read-only and fails if a relevant source differs from `1d80934`. It writes evidence only beside itself. **60 independent assertions pass; zero sampled real-producer validation failures; one intentionally asserted corrupt-source acceptance reproduction.** [run.txt](run.txt) records the fresh result. An exit0 means the review reproduction succeeded, not that the implementation is approved.

Root's191 tests/typecheck/build and E's168 tests/46 native-flow assertions are supplied integration/author evidence, not new independent assertions. No browser suite, broad test suite, typecheck/build or server was rerun. The corrected optional-prediction validation was source-reviewed at `finite-practice-result.ts:134-159`; its author's actual prediction fixtures were inspected, not recounted as independent executed coverage.

## Ranked finding

### 1. Submitted non-clean source can omit its unavoidable first-position key — correctness blocker

`finite-practice-result.ts:100-112` checks any keys that are present, but permits an empty key object. Required key presence is enforced only inside the eligible/clean branch at **lines113-121**. The aggregate checks at **lines161-163** can be made consistent with the missing key data. This admits a source that the actual engine cannot produce.

**Minimal complete-envelope reproduction:**

1. Use the actual adapter and `he` plan; mark the first physical key as repeated, then type every expected character and submit all12 prompts. The genuine result is early, repeat-flagged in its first sentence, ineligible for progress and100% accurate. It passes the finite validator.
2. Clone it. Set `sentences[0].keys={}`. Subtract that sentence's key-correct total38 from `metrics.correctAttempts` (501→463), recompute accuracy as463/501×100, and set the final chart accuracy to the same value. No prompt/response/plan/count/elapsed or flag change is necessary.
3. `validateFinitePracticeResult(corrupt, suppliedPlan)` **accepts and returns the corrupted source**: elapsed512ms, retained501, attempted501, correct463, accuracy92.41516966067864, deleted0, with an empty first-sentence key map. The exact accepted payload is in `results.json.observations.emptyKeyEnvelope.source`.

This is not merely uncertainty about the exact timing distribution. Every nonempty submitted response must start with an insertion at response position0; `engine.ts:305-319` records that position's expected prompt key and first attempt, even when tracked input is invalid, repeated, wrong or later edited. Counts survive edits until commit. Every finite plan prompt is nonempty, and every submitted finite sentence is required to have a nonempty response. A submitted sentence with no record for `promptText[0]` is therefore impossible under this producer. Source hashes would only identify the corrupted bytes.

**Smallest correction:** before the eligible-only full-frequency check, require the expected key at initial position0 to exist for every submitted sentence. Its existing per-key rules already require a positive attempt/first-attempt count. Equivalent necessary producer-accounting validation is acceptable. Do **not** extend the clean full-key-frequency requirement to all edited sentences: some valid edits never attempt other original positions.

**Positive counterexample limiting the fix:** independently type the first prompt backwards by repeatedly inserting at position0, then submit its now-correct full response. This valid edited/incorrect sentence records only key `p`, the first expected key of `put the clean cups on the wooden shelf`; all other prompt key names may legitimately be absent. The actual adapter result currently passes, and must continue to pass after the fix. `results.json.observations.validReverse` retains this boundary. This is a necessary source-consistency guard, not a new coaching gate, accuracy floor or metric change.

Author acceptance should reject empty/missing-first-key variants of non-clean sources with coherent root/chart aggregates, retain the reverse-insertion case and ordinary edited/invalid/repeated traces, and rerun the focused finite tests. Root received the finding in **`msg_1b530ffc91d6`**. No production patch was made, and no further audit expansion is needed for this REVISE verdict.

## Other reviewed questions and evidence

- **Atomic end/no wrap:** actual adapters for he/in/le/th submit exactly their12 certified ID/text contexts and finish with `plan-exhausted`, final-context prompt and `next=null`. `completedSentences` is12. Post-terminal edit/abort/interrupt/tick cannot alter the captured terminal state; source results are defensive copies. The adapter owns its validated plan despite caller mutation. Shared deep-freeze recursion works through a pre-frozen parent.
- **Timeout precedence and counts:** final submission at deadline−0.0001ms yields finite end with12 submitted contexts; exactly/after the deadline yields timed timeout,11 completed submissions and the ordinary unfinished last summary. Timed results pass the unchanged timed validator. `completedSentences: state.sentenceIndex` correctly counts submissions in finite end, timeout, abort and stop; it does not count the active unfinished summary.
- **Real producer/validator reconciliation sampled:** all four clean plans validate with actual-time WPM/accuracy. Additional real traces with tail deletion/correction, reverse middle insertion, missing/malformed timing, repeat, invalid input and interruption produce no validator failure. Response-limit stop and abort remain distinct and yield no result; terminal snapshots remain frozen. Default timed two-prompt mode still wraps.
- **Negative shape/domain/relations:** wrong plan hash, extra manual provenance, bad calendar UTC, wrong WPM, zero elapsed, fractional attempts, excessive pair count, missing clean key, wrong final chart and sparse sentence arrays reject. This bounded sampling does not prove all possible corruption rejects—the ranked counterexample proves otherwise.
- **Source boundary:** real early results are rejected by the timed validator, carry the distinct schema/termination and false progress eligibility, and are filtered out before the assessment calibration consumer. Finite `result()` is separate from timed `result()`; no legacy `practiceFocus`/manual/retest authority is manufactured by the adapter. Persistence, full policy source-union admission and UI remain C/D/F integration acceptance, not E defects merely because they are unfinished.

## Remaining acceptance and scope

After the narrow author correction, root needs focused independent reacceptance on the exact changed blob. C/F must still demonstrate real save/history/retry/export/capture through early end, failures and rapid Again; D must exclude early finite sources from all evidence components while ordinary eligible timed practice can update the next block. Actual Claude owns flagged/early explanation and conditional figures; source validation alone does not accept their presentation. No live database, full policy/authority review, user data, human learning/dose claim or deployment is part of this review.

Task `task_b9006db69620`, dispatch `ctx_33d22197e720`, terminal `term_43c58d54-273b-4cc8-93ae-5c3459664546`, run `run_1aeb00550f39`. Receipt **`f701fdf7-e3e7-44e0-b479-ca881c3bf5c1`** reports Codex/model `gpt-6.1-sol`, live exact-worker observation and a connected reused terminal. Capable/high is requested; reuse launch model/effort fields are null, so effective effort/backend identity are not independently inferred. Only the leased `implementation/finite-review/` directory changes; prior reviews and root remain untouched. No helpers or additional workers were started.
