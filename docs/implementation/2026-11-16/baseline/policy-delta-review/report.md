# C2 delta acceptance — REVISE

18 November 2026. Reviewed **P1 r1 `747d3e7bc22965eaf8ea2b22df0f0070f01be43c`**, root import **`03abfdb2daf5013c59632a31baaf328ab6b68b46`**. Original C2 `87fe85ecb703a255faea046a2294419be7d5dcff` and its original REVISE report remain unchanged. This verdict applies to the r1 contract delta, not to a production implementation.

**REVISE:** r1 closes the original fabricated-complement exploit, connects qualification to a valid certificate and substantially improves relational/summary semantics. Its new “necessary” elapsed-time envelope nevertheless rejects a valid result from the current producer. Its disabled-coaching scope also cannot fulfill root's explicit baseline-to-supported-personalized-practice objective. Staging a summary is permissible as an intermediate delivery; it is not completion of that objective.

## Provenance and runnable evidence

All source references below are at `747d3e7`, unless stated otherwise. Full paths abbreviated `policy/` mean `docs/implementation/2026-11-16/baseline/policy/`; `spec` means `.omx/specs/typeforge-practice-policy-v1.md`.

- [input-manifest.json](input-manifest.json) records exact Git blob IDs and raw SHA256 for the reviewed spec, amendment, checker/receipt, config/schema, sidecar schema/examples, finite catalogue and application producer/core. Policy files at `747d3e7` and `03abfdb` compare equal. The runner proves checked-out producer/core text equals the frozen revision before importing it.
- Producer identities: `typing-app/client/src/app.ts` blob `6135d9006dc52aea054b2036300fb881232a90f9`; `engine.ts` blob `8f7c690a190b495fa28c062e70b5218d4095c55c`. Both are unchanged from the reviewed application baseline. No production, author-owned policy or original C2 artifact is modified.
- [review.mjs](review.mjs) extracts frozen Git inputs into ignored `input/` inside this review directory. It replays the author's original checker with only import locations, output location and exported test seams adapted; it does not copy a repaired checker over r1. Generated replay files can be recreated from Git and are not committed.
- [review-results.json](review-results.json) retains the actual counterexample result and every keydown/input timestamp, independent certificate results, nonzero summary examples, half recomputation, dedup and filter endpoints. [run.txt](run.txt) contains the fresh console receipt. [verification.json](verification.json) records final checks and scope boundaries.

Run from this isolated review checkout, with Node24 and the frozen Git objects available:

```text
node --check docs/implementation/2026-11-16/baseline/policy-delta-review/review.mjs
node docs/implementation/2026-11-16/baseline/policy-delta-review/review.mjs
```

Result: **48 new explicit assertions pass; all106 author assertions replay successfully.** The106 are reproduction, not106 additional independent checks. Some new tests call the author functions under review with independently constructed engine inputs; certificate arithmetic, expected summary values and half totals are independently calculated. No browser, storage race, human measurement or new implementation is implied. The runnable counterexample is an expected passing reproduction assertion, not an unexplained test failure. Original model/profile tests and their25-pass receipt are unchanged; they were not rerun or counted as new delta coverage.

## Ranked findings

| Rank | Verdict / confidence | Finding | Minimal correction |
| --- | --- | --- | --- |
| 1 | Correctness blocker / high | New elapsed-time rejection assumes pair timestamps and `elapsedMs` share an origin. Current app/engine start them at different events. | Correct or remove the unsupported necessary-bound claim/gate for metric1; add independent keydown/input and deadline fixtures. Do not fix by arbitrary tolerance or silently change producer/metric semantics. |
| 2 | Objective/acceptance blocker / high | Exact r1 config disables coaching and exact schema fixes it false. A qualified `he` history therefore cannot enter personalized practice under r1. | Keep summary as a stage; define the reviewed enabled identity, finite exhaustion behavior and end-to-end acceptance as remaining required work. Do not declare summary-only delivery complete. |
| 3 | Implementation prerequisite / high | Finite text certificates and relational arithmetic pass; current engine still wraps to the first prompt at template exhaustion. Summary range authority and source races are not established by in-memory fixtures. | Implement/test the finite boundary and coherent admission before enablement; A2/H3 retain lifecycle/storage ownership. |

### 1. “Necessary” time envelope falsely rejects current-producer data

**Contract:** spec:85-87 (admission items5–7), especially item6; `policy/revision-check.mjs:97-110`; config `admission.runMinimumTimeToleranceMs=0.000001`. The rule rejects a run when:

```text
sum(count * exp(logSum/count)) + omittedWithinWordIntervals * 5000
    > metrics.elapsedMs + 0.000001
```

Geometric means do lower-bound sums over the represented inter-key intervals. The unsupported step is bounding that keydown-time span by the run's input-start duration. `app.ts:595-611` captures a physical key's `time` during keydown; `app.ts:625-635` obtains a later input `now` and passes both to the engine. `engine.ts:294-297` starts the run at input `now`; `engine.ts:323-338` calculates intervals from `pressTime`. The producer accepts a first keydown before the first input. Saved metric1 aggregates do not preserve that initial offset.

**Exact independent counterexample:** immutable `assessment-005`, `please set the empty bottles beside the recycling bin`. First keydown0ms, first input1ms. The unique pairs `pl`, `ea`, `as`, `et`, `em`, `mp` each receive5000ms. All remaining actions use0.001ms; subsequent input times equal their keydown times. Each character and final submission is sent through the actual engine as a genuine single append. The full event trace is committed in `review-results.json.evidence.laggedTime`.

The sentence is submitted, clean, fully attributed and valid under both the actual engine and unchanged saved-result validator. Its keys/counts/logs also pass r1 `sentenceIssue`. It completes within the input-start30s window and reports `elapsedMs=30000`. Yet the r1 aggregate bound is **30000.030000000028ms**, so `runIssue` returns `coach-run-envelope` and excludes the entire run. There is no corrupt aggregate or fabricated interval in this input. Its tiny synthetic intervals are inside the explicitly supported positive sub-ms domain; this is not a claim about real users' event frequency.

Deadline controls with first-input lags0/0.01/0.1/1ms respectively produce0/0/1/1 complete eligible sentences. The incomplete controls correctly supply no sentence evidence; both genuinely completed cases are incorrectly rejected by the time rule. Independent0.25ms clean input is admitted, as are4999.999/5000/5000.001ms endpoint fixtures: only the last endpoint omits its one filtered interval. Thus the issue is clock alignment, not a proposal to reject sub-ms observations, include >5000ms timing or weaken target support.

**Required author amendment:** distinguish a physical necessity from an experimental conservative admission choice. For current metric1, remove this hard rejection unless a valid bound can be derived from fields actually saved and the proven producer clock contract. If a conservative heuristic remains, explicitly disclose legitimate producer histories it can exclude and obtain root's policy acceptance; do not call those sources physically impossible/corrupt. Retain the all-pair/key/count/domain guards that close the original exploit. Any newly persisted aligned-time evidence or changed timer origin needs its own reviewed instrument/version boundary. Neither an arbitrary larger epsilon nor rewriting historical `elapsedMs` repairs the claim.

Acceptance fixtures must independently vary keydown and input times, include first-input latency, just-before/at/after the deadline, legitimate positive sub-ms intervals, exactly5000 and filtered >5000 gaps, and still reject known impossible domains/counts. Persisted final response length or wall-clock completion time cannot recover the missing offset. Root acknowledged this reproduction in `msg_7803a9001b86`; no author-owned edit was made here.

### 2. Closed original issues and the remaining delivery contract

| Original issue | Delta assessment | Evidence and boundary |
| --- | --- | --- |
| R1 absent/excessive reference pairs and impossible logs | Original exploit closed; elapsed-time addition needs revision | All-pair occurrence/key/log guards in spec:82-87 and checker:78-110 reject absent `zz` and impossible lower/nonfinite logs. The old legacy-valid mutation no longer yields timing; ten-test participation remains10. Aggregate authenticity remains explicitly unproved. |
| R2 disconnected `br` certificate | Resolved as mathematical feasibility evidence | Same ten real-engine `he` histories give full28/543, halves10/234 and18/309,10 target runs,19 prompts,4 words. Full pipeline below/at/above249.999999/250/250.000001 versus200ms returns false/true/true. `br` stays exposure-only and absent from the catalogue; gates are not lowered. |
| R3 halves, latest-text retention, summary arithmetic | Substantially resolved at contract/arithmetic level | Newest-before-semantic-exclusion and greatest ordinal are explicit; reference-only runs participate in deterministic whole-run halves. Schema remains structural, with semantic authority separately required. Actual transaction/range/race proof is still future integration. |

The independent certificate calculation scans every integer prefix of all four immutable templates without using the author certificate function:

| Pair | Characters | First target end | Distinct words by240 | Complete passages by480 | Prefix failures |
| --- | --- | --- | --- | --- | --- |
| he | 501 | 7 | 8 | 11 | 0 |
| in | 491 | 11 | 9 | 11 | 0 |
| le | 502 | 8 | 9 | 11 | 0 |
| th | 480 | 10 | 3 | 12 | 0 |

Config binds the catalogue hash; the catalogue binds bank identity and ordered plan hashes. The author's tampered-order/bank checks replay successfully. Certificates establish expected text arithmetic, not realized dose, uniform sampling, cross-block novelty or useful human learning. Keeping actual exposure unknown without an instrument is appropriate and need not prevent a carefully scoped supported-practice implementation.

**Scope conflict:** spec:9-11,120-139,190-192; config:92-96; schema:361-374. The valid r1 config has `releaseScope.automaticCoachingEnabled=false`, and its exact schema requires that value. Our connected fixture has participation10, timing qualification and a certificate, but effective auto-suggestion remains false. This is correct execution of the disabled scope, not a selector bug. It nevertheless fails root's explicit full objective. Changing false to true without a newly reviewed identity/schema is not an authorized shortcut. A summary can be useful without replacing the required supported-personalized-practice path.

**Finite exhaustion prerequisite:** the actual engine, fed all501 characters and12 submissions of the certified `he` template at1ms/action, is still running at approximately514ms and wraps to `practice-003` again. There is no repeat inside the certificate and no authorization for that new cycle. r1 correctly acknowledges this gap at spec:129; it must be resolved before automatic enablement. An adapter must prevent uncertified modulo continuation and preserve the admitted snapshot and result/30s completion meanings. Stop/pause/reprepare behavior needs a concrete reviewed contract; this review neither selects UX behavior nor implements it.

### 3. Relational halves and summary: independently supported, authority still separate

**Halves:** new independent raw-source recomputation inserts an earlier reference-only completed run, deduplicates latest text, collects all contributing run IDs, splits5/6 and sums target/reference logs directly. It matches r1 exactly: old half **7 target/217 reference,4 target-bearing runs**, new half **21/354,6 runs**. Full target28 still passes support, while half7 deliberately fails stability. Adding reference-only data can therefore retire a previously stable focus through the specified partition; this is conservative policy behavior, not observed learning/mastery or a contradiction. The independent log totals agree within1e-10. This goes beyond replaying the author's scalar/half assertions.

**Dedup:** a newer unknown prompt ID carrying the exact text of an older valid target row supersedes that text and is then excluded for identity. The older row does not re-enter. This independently checks latest-before-exclusion and no backfill. A rejected reference pair cannot remain in another candidate's complement under the r1 all-sentence exclusion.

**Summary:** independently generated real-engine source metrics produce nonzero expected medians: ten assessments with0..9 correct positions out of10 attempts give median WPM1.8 and accuracy45; the eleventh all-correct saved assessment shifts newest-ten medians to2.2 and55. A practice source does not replace an assessment witness. Reversed page order retains the same newest ten. One null accuracy yields null median accuracy with9 valid sources, while median WPM remains available. These arithmetic semantics are supportable from existing fields and imply no learning improvement.

**Authority limit:** spec:55,166-170 separately requires newest-range/selection proof; ten present IDs alone prove only capped participation. `revision-check.mjs:60-74` accepts a supplied array and can return a summary from ten cached sources even with `exhausted:false`; it has no parameter proving those are the newest range. The retained `cachedTenIncompleteRange` example demonstrates that helper boundary. This is not evidence that the stricter spec permits arbitrary cached medians. Actual range coverage, concurrent insert/delete, all-writer revision ownership and transaction behavior remain A2/H3/integration acceptance. In-memory source maps, hash comparisons and race booleans are not executed IndexedDB tests, and they are not counted as such here.

## Minimum remaining acceptance for the full requested path

1. Resolve the clock-domain admission issue with the above current-producer fixtures; retain independent no-effect, count/context, finite-domain and half constraints.
2. Freeze a root-accepted **enabled** policy/config/schema/catalogue identity and a compatible finite exhaustion rule. A staging plan may retain intermediate summary milestones, but its completion criterion must include supported personalized practice.
3. Implement the pure selection/summary/certificate boundary with the connected `he` fixture, a valid no-target fixture and the full model-loading matrix: missing/malformed Ridge must not invalidate an independently valid coach; invalid coach config must not be rescued by valid Ridge. Preserve the existing assessment prediction/calibration cohort.
4. Integrate bounded coherent saved-source/membership admission, newest-ten summary and newest20 coach selection under A2/H3's reviewed lifecycle contracts. Begin with ten saved assessments, prepare a real certified practice block, then save its result/membership and demonstrate that only the subsequent preparation can change/retire the focus. Failed/pending saves cannot manufacture participation or evidence; active snapshots remain frozen. No legacy result/focus field is silently reinterpreted as the new coach provenance.
5. Test the finite template boundary at fast synthetic speeds, not just ordinary prefixes: no wrap or uncertified text after exhaustion, valid result semantics, no mutation of a running snapshot. Verify actual prepared prompt IDs/text match the admitted certificate. Realized exposure may remain unknown and must not be inferred from final response length.
6. Actual Claude owns UI/state/explanation and existing immediate General30s acceptance; root owns combined technical/Claude reconciliation. C2 does not approve visual design, copy or production delivery from these probes.

These are implementation prerequisites, not a new data-collection/study requirement. Human reach, burden, target usefulness, false targeting, transfer and retained improvement remain unmeasured; no need to claim them to test the requested end-to-end mechanics. A2/H3 own the full lifecycle/storage reviews; this report does not duplicate or supersede them.

## Completion receipt and boundaries

Task `task_9b182b8f1756`, dispatch `ctx_5fbf9ca8eedf`, run `run_1aeb00550f39`, terminal `term_43c58d54-273b-4cc8-93ae-5c3459664546`. Requested capable Codex `gpt-6.1-sol/high`; live receipt `2feb926b-ce7f-475e-8f98-f9a529199bb8` reports Codex/model `gpt-6.1-sol` in the reused terminal. Reuse launch fields do not independently expose effective effort; no effort/provider/account setting was changed and no backend-serving identity is claimed. Fresh liveness was confirmed on continuation.

Only `policy-delta-review/` is changed. No helpers, production/spec/UI/package changes, global edits, dependencies, browser session, deployment, model fitting or user-data collection. Primary-research claims are unchanged from the original review; this delta does not restart literature research. Root received the clock finding in `msg_de4f9fda9c2e` and directed a frozen bounded report in `msg_7803a9001b86`. Final outcome is a completed **REVISE review**, with author corrections and actual end-to-end implementation still required.
