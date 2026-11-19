# C2 independent policy feasibility review — REVISE

16 November 2026. Ordinary bounded technical review; no UI/design judgment. **REVISE the frozen P1 contract/evidence before automatic coaching implementation.** The participation/abstention distinction is explicit and technically coherent. The personalized path is possible on this corpus, but P1's only passing exposure example cannot qualify as a target, and its source-integrity assumptions leave a concrete route to fabricated contrast. Neither finding justifies lowering thresholds.

## Reviewed identity and reproduction

- Frozen P1: `e4847548380cd50cde911645314dc023737068ad`, tree `99920f7576f677dae6ed50fabe2b8e300e747568`.
- Root import: `11b1853427c14f251a778fb0d2220c4c05b4b796`. `git diff --quiet e4847548380cd50cde911645314dc023737068ad 11b1853 -- .omx/specs/typeforge-practice-policy-v1.md docs/implementation/2026-11-16/baseline/policy` exits 0: reviewed policy files match.
- Review checkout: `706e4593c2d302042679e1c3c8bd6140dd3ced69`. Application baseline `b3fb14c17c89b8825223f230da08be265eaa16cf`; `git diff b3fb14c -- typing-app/client/src` is empty.
- Reviewed spec Git blob `a991087d87e6f6610cbc728314e00e655117ea88`; engine blob `8f7c690a190b495fa28c062e70b5218d4095c55c`; storage blob `378ab851a96d7778f17f6b9531a53370e798b791`; corpus blob `f50180ea88f95d1b0c2a999a3e94f447a2b587fb`.
- [probe-results.json](probe-results.json) records SHA256 of every reviewed policy/config/schema/fixture/probe/evidence file and core application sources, plus this probe's script hash. Raw-byte hashes may differ after line-ending conversion; the above frozen Git comparison supplies text provenance.

Run from repository root with Node 24.21.0:

```text
node docs/implementation/2026-11-16/baseline/policy-critique/probe.mjs
node --experimental-strip-types --test typing-app/client/tests/profile.test.ts typing-app/client/tests/model.test.ts
```

Evidence: **62 explicit independent assertions pass; 25 existing profile/model tests pass, zero failures.** The independent probe imports only the real corpus, engine and result validator, never P1's contract checker. It writes only its sibling JSON. P1's checker was inspected rather than rerun because it writes into another lane's frozen artifacts. Production source, spec, schema and package files are unchanged. No additional lint/build run is warranted for unchanged application code; there is no project lint script. A syntax check of this standalone probe is included in final verification.

## Ranked findings

| Rank | Class / confidence | Finding | Required amendment |
| --- | --- | --- | --- |
| 1 | Correctness blocker / high | Strict current result validation does not establish valid complement attribution or feasible timing aggregates; validating only the target's occurrence count can manufacture a focus from uniform data. | Specify additional coach-specific semantic input validation for every contributing pair/sentence and finite arithmetic; retain rejected sources as readable history with diagnostics. |
| 2 | Evidence acceptance blocker / high | The original passing `br` certificate is disconnected from qualification: the entire frozen assessment+practice corpus has only 17 deduplicated occurrences, below 20. | Include a connected real-engine qualification + all-prefix certificate witness for the same pair/context/window, with negatives; retain `br` as an explicitly nonqualifying exposure example. |
| 3 | Implementation contract / high | Original half/effect/authority fixtures exercise independent numbers or booleans, not their relationships. The spec delegates semantic validation but does not sufficiently lock it with examples. | Add compositional half, attribution/dedup, finite-domain and final-admission race fixtures before implementation. Define the accepted-run half partition explicitly. |
| 4 | Reach/burden, unmeasured benefit / high for bounds, unknown for people | Latest-text dedup + target20 caps assessment-only personalization at four possible pairs, regardless of how many tests are repeated. Actual `met` exposure at character240 requires at least 96 retained-character WPM in a 30s run. | Record structural coverage and short-run limitations; do not present General fallback as evidence of broad personalized reach or label a dense partial as failed delivery. Root/Claude own any product/presentation decision. |

These findings concern the proposed future coach. They are not claims that an adaptive implementation already exists or that the existing prediction/calibration path is broken.

## 1. Source integrity: target-only attribution leaves the complement unprotected

**Evidence.** The spec's source validation, full-target attribution and complement arithmetic are at `.omx/specs/typeforge-practice-policy-v1.md:69-83`; finite validation and compensated accumulation at lines75-76. Current `typing-app/client/src/storage.ts:131-167` validates each pair's shape, count1..299 and a broad log-sum range, but does not require the pair to occur in the prompt, bound its count by actual occurrences, or relate total observations to available attempts. A log sum down to `-Number.MAX_SAFE_INTEGER` is accepted. Actual engine intervals come from adjacent genuine lowercase appends and the `0 < interval <= 5000` filter at `engine.ts:323-355`; the saved shape alone does not prove that origin.

**Independent reproduction.** [probe.mjs](probe.mjs), `malformedReference` in its JSON:

1. Generate twenty valid, completed 30s assessment runs through the actual engine, with every admitted interval200ms. Validate every result using the unchanged application validator.
2. Original `he`: target49/reference862, full delta about `4.88e-14`; halves21/363 and28/499. Support and certificate pass; no-effect correctly abstains.
3. Add `pairs.zz={count:299,logSum:-9007199254740991}` to every eligible sentence. No prompt contains `zz`. The current validator still accepts each modified result.
4. The target `he` count still matches its prompt's full occurrence count, so the stated candidate-attribution gate does not reject these sentences. Complement becomes10430; delta about `2.763e13`. Both halves, support and the real `he` certificate pass under an implementation that relies on current strict validation plus candidate-only attribution.

This is intentionally malformed synthetic input, not observed user behavior. Source hashes do not repair it: hashing an accepted impossible payload only identifies those bytes. `exp(delta)` would overflow; decisions must compare finite log differences without converting arbitrary ratios to milliseconds. A lower-bound log sum far below `count * log(Number.MIN_VALUE)` cannot arise from any positive finite binary64 interval at all. Valid sub-ms logs must remain allowed; banning all negative log sums is incorrect.

**Amendment.** Before accepting a sentence into any candidate's reference pool, verify immutable prompt membership/text and every contributing pair's count against its available within-word occurrences, check count totals against feasible sentence/run envelopes, reject impossible aggregate domains, and reject nonfinite accumulation/subtraction. A partial count may be legitimate after the >5000ms filter; require equality only where full target attribution is needed. Do not invent positions for a partial reference or target aggregate. Define exclusion scope/reason so adding malformed data cannot yield a suggestion. Where aggregates cannot authenticate individual intervals, state that residual trust limit instead of claiming reconstructed verification. Preserve historical result validation/calibration semantics; these are additional coach-admission guards.

**Acceptance tests.** Absent reference pair, excessive reference count, impossible lower aggregate, nonfinite sum/difference, zero reference, positive sub-ms intervals, exactly5000ms and >5000ms, plus uniform/all-order no-effect cases. Rejected/corrupt data must not lower participation via an unrelated new perfect-sentence requirement. The probe proves the existing validation gap and one sufficient count rejection, not a completed replacement validator.

## 2. A connected path exists, but P1 did not demonstrate it

**Frozen evidence.** Spec lines190-194 and `policy/coverage-report.md:32-51` separate support from exposure and disclose that timing/stability remain unproved. `policy/coverage-probe.mjs:63-78` calculates a count/context ceiling; lines85-135 certify six selected pairs under one static ordering. `br` is its only passing certificate; lines149-151 explicitly generate no timing effect/stability. Those caveats are honest, but the resulting examples cannot demonstrate one complete personalized path.

**Independent corpus bounds.** Overlapping within-word pairs are counted from each immutable word; exact prompt text is deduplicated across the 40 assessment and80 practice texts. `br` has6 assessment +11 practice =17 total opportunities. Since partial attribution can only remove observations, it can never reach20 in this corpus under the stated dedup rule, even with infinite repetitions, practice feedback and an unlimited age/window. Its exposure certificate is valid, but it cannot be an automatic target. `ag` totals7 and lacks four practice prompts; `au` totals2 with one practice word/prompt; `zz` is absent. Keep all these negatives.

The independent constructive search tests the280 pairs present in either bank. The other396 lowercase pairs have no source opportunities. Among the280, 141 fail the declared bank-context prerequisites; `ay`, `da`, `wh` fail every possible first whole target-bearing prompt before it ends, so no later passage can repair the all-prefix violation. For the remaining136 the search constructs and independently verifies a finite >=480-character plan. Search is capped at2000 nodes per pair; **none hits the cap**, and a constructive success needs no exhaustive search claim. This does not measure a uniform sampler's probability of finding/choosing those plans. It does refute an inference that P1's failed `he/th` orderings establish impossibility.

Only `he`, `in`, `le`, `th` have >=20 occurrences in the entire deduplicated assessment bank:

| Pair | All40 assessment opportunities | Best20 assessment prompts ceiling | Assessment+practice ceiling |
| --- | --- | --- | --- |
| he | 59 | 41 | 171 |
| in | 30 | 29 | 73 |
| le | 21 | 21 | 50 |
| th | 62 | 43 | 170 |

The best20-prompt column is not the policy's20-run window. Runs can contain several prompts. Across both banks52 pairs have >=20 global opportunities and a constructed certificate, an upper bound only: not52 proven temporal/half/time-qualified targets.

### Connected deterministic witness

Use `he`, ten ordinary assessment runs, flow-v1, 30s, QWERTY, en, corpus1, metric/schema1. All runs complete on16 November2026, in one assumed context/epoch, within30 days. Source IDs are unique valid UUIDs. Fresh independent xorshift/Fisher-Yates shuffles use seeds1001..1010. Character delays are250ms for `he`, 200ms otherwise, including explicit submission actions; the actual engine enforces the deadline. No learned model/artifact is imported. All saved-shape results pass `validateResult`; no storage or sidecar write is claimed.

After latest eligible exact-text dedup: **28 target /543 complement intervals, 10 target-bearing runs,19 distinct target prompts,4 target words**. The chronological accepted-run halves give **10/234** and **18/309**, five target-bearing runs each. Full and both half ratios are1.25; the half requirement is only1.10. This proves a mathematically possible selected-text contrast, not a deficit, actionable weakness, uncertainty bound or learned effect.

Use this `he` practice plan, all existing whole prompts, no repeat:

```text
practice-003 practice-019 practice-048 practice-013
practice-078 practice-028 practice-001 practice-036
practice-054 practice-002 practice-047 practice-074
```

It has501 canonical characters,8 fully traversed target words by240,11 distinct complete passages by480 and no failed integer prefix20..501. General's comparator is112/3427. A separate integer-arithmetic certificate checks `4 * targetOpportunities * 3427 >= 5 * n * 112` at every integer prefix. There is no cross-passage pair or synthetic separator in its denominator. The same ten-run engine path at249.999999/200ms fails full effect; at250/200 and250.000001/200 it passes, with support/halves/certificate all evaluated rather than injected as true.

The JSON also retains a2x-contrast witness and32 fixed schedule settings (8 seeds ×2 speeds ×10/20 runs), each checked for four eligible assessment candidates: **128 candidate-specific synthetic histories**, not128 people or a shared-history yield estimate. Passing counts over32 are he30, in10, le2, th32. At least one candidate-specific history passes in every schedule setting. These deliberately favorable, clean, constant-delay simulations establish possibility only; they do not establish recommendation frequency, false-target rate or learning usefulness in users.

**Amendment / acceptance.** Add a frozen connected witness and negative variants to P1's revised acceptance evidence. Keep original disconnected/impossible cases, no-effect variants and all-prefix checkpoint failures. Keep the same thresholds and source/run/window/corpus constraints. This review provides the witness without modifying the frozen input.

## 3. Halves, deduplication, schemas and decision authority need relational fixtures

The prose/config largely agree on10×30s, newest20 runs/30 days,20/80/4/4/3 support,1.25/1.10 effects and all-integer prefix certification. I found no basis to reject the baseline simply because it can be completed with one wrong key per test: spec lines23-41 explicitly distinguishes that milestone from timing readiness, and ten real-engine one-key completions produce zero eligible timing in this probe.

The spec also correctly states that current count/logSum fields do not recover omitted positions, variance or causal learning. At line73 full target-count equality prevents claiming every word when one of several target positions was filtered. `the other theme` with two retained `th` intervals cannot identify which of the three words lost one. Whole spelling diversity, not word tokens, is the intended count.

However, `policy/check-contract.mjs:117-142` supplies `halfTarget`, `halfReference`, `halfRuns`, `ratio`, `halfRatio` as unrelated scalar overrides and models races as conjunctions of booleans. It does not partition sources, derive a complement, deduplicate prompts, verify source hashes or reconcile a sidecar. Lines94-103 check a structurally supported focus without proving its witness sources. Lines34-38 label Ridge states but do not load a model; this proves no application integration. Our engine witnesses import no model artifact and demonstrate separate arithmetic possibility, while eventual integration still needs the explicit Ridge/config availability matrix.

**Half definition amendment.** Explicitly fix the sequence: newest20 compatible completed runs before looking at sentences; newest eligible exact-text retention; candidate-specific full-attribution exclusion; collect all retained contributing source-run IDs, including reference-only runs; sort by `(completedAt,id)`; split `floor(n/2)`/remainder, never split a run. Each half's `sourceRuns` means target-bearing source runs. Define deterministic order/identity for same-prompt duplicates within one result, even if the current engine rarely produces them. The current phrase “accepted source-run IDs” at spec line77 should not leave implementers choosing target-bearing-only halves. This probe uses the all-contributing-runs interpretation and does not prove other interpretations equivalent.

`coach-sidecar.schema.json:12-32,60-79` intentionally enforces shape, not authority: e.g. zero counts or fewer than10 witness IDs remain structurally possible in a `suggested` record. This is **not itself a schema contradiction** because spec lines125-129 explicitly require semantic validation. It becomes unsafe if the148 checker assertions are treated as proof of that missing validator. Exact full/half counts and log sums must compose, witnesses must prove participation, certificates must bind actual plan text/corpus/config, and source hashes/membership must be verified at final coherent admission. Finite `type:number` also does not establish interval feasibility. The local date oracle at checker line58 uses permissive `Date.parse`; strict UTC validation should reject normalized invalid calendar dates as well as bad strings.

Required boundary/negative vectors are retained in JSON `negativeCases` (acceptance requirements, **not executed race tests**):

- Conflicting payloads under one source ID, overlapping pages, same text under another ID, immutable-ID text mismatch, newest partially attributed target superseding older full evidence; no candidate-specific older backfill.
- Full20 with oldest-half7/newest13; pooled effect passing with uniform newer half; reference-only runs moving the split; odd counts, tied timestamps and permuted pair/object order. Count-run-context support must arise from one witness set, not independently adjustable gates.
- Twenty recent integral but errorful/no-clean runs evict older clean runs. This eviction is actually exercised through engine results here. Exact30-day, ±1ms/future and19/20/21-window boundaries are independently checked. Old participation never makes old timing fresh.
- Suggested sidecar with9 witnesses, missing/hash-mismatched sources, halves not summing to full, valid-looking certificate hash for different text, duplicate derived IDs, reset during an old in-flight run, failed membership write followed by reload, and final-read source rewrite/deletion. Existing generic history reads and immutable snapshots are necessary but do not implement these cases.
- Admission after typing starts must fail; deletion after admission preserves the running historical snapshot but cannot authorize a later run; storage/scan failure is pending/unavailable rather than empty/no-effect. Preserve the shared row/byte budget and final coherent transaction from spec lines133-143. Do not reopen this review as a DB implementation approval.

Raw-event arrays in the probe independently check19/20/21 target counts,79/80/81 complement counts,3/4/5 run/prompt identities,2/3/4 word spellings,7/8/9 half targets,19/20/21 half references and1/2/3 half target runs. They are explicitly artificial boundary witnesses; they are not all jointly realizable corpus histories. The separate engine witnesses supply joint feasibility.

## 4. Reach, actual short-run exposure and a smaller bounded implementation option

**Evidence versus inference.** Global dedup means more identical tests cannot increase total unique support indefinitely. Four possible assessment-only pairs is a corpus bound, not a forecast that four suggestions will appear. `le` has only21 total assessment occurrences, so the20 gate needs nearly its entire available support. Requiring20 rather than, say,12 sharply affects reach; no paper makes20 scientifically necessary. This review does not lower it or equate its synthetic outcomes with human yield.

The all-prefix rule is feasible and cheap to verify for a finite prepared plan: scan each character once with running counts/sets. It does not require a costly online combinatorial search at each preparation. P1's earliest-target-first ordering is insufficient for `he/th`, but the independent density-first bounded construction finds both in13 visited nodes. Other orderings' failures should stay labeled ordering failures, never global impossibility.

At the same250/200ms timing as the connected assessment witness, execute the certified plan as a real30s **practice** run:144 reached characters,11 target opportunities,5 distinct target words,3 completed passages, passing density. The frozen status rule still returns `partial-context` because n<240. At125/100ms, the same plan reaches289 characters,19 opportunities,8 words and6 passages, status `met`. These exposure counts are reconstructed here only because the synthetic recipe is known to be correct contiguous appends; the application still needs the reviewed first-attempt-frontier instrumentation for real edited runs.

Character240 is at least96 retained-character WPM over30s; submission actions consume additional time. Character480 is at least192 WPM. Thus four-passage-by480 is usually a certificate/very-fast-prefix condition rather than a demonstrated30s delivered context requirement. I do not infer actual human speeds or their distribution. The144-character example shows that “partial-context” can already include five target words: the240 floor is a provisional policy category, not an empirical minimum for useful exposure. Repeating the same certified prefix in every new30s block can repeatedly show the same words; specify whether no-repeat-before-bank-exhaustion is per-plan only (the natural current reading), and do not claim across-block novelty without a separately bounded cursor/rotation rule.

**Smaller contract option, for root to assess.** Retain the reviewed signal, participation and thresholds. Start with a small corpus/config-hashed finite certificate catalogue for the four assessment-capable pairs, each bounded to e.g. one <=600-character template. Recompute its exact certificate at preparation and fail closed on any text/hash/prefix/context mismatch. This avoids a runtime optimizer, general-purpose sampling search and any implication that all catalogue pairs can qualify. Persist only the already-required source membership and immutable explanation; keep actual exposure unknown until its instrument is implemented, then report observed density/counts separately from the provisional240/480 categories. No observed dose or “met” claim may be backfilled from a saved response length.

Tradeoffs: this narrower pilot forgoes other potentially qualifying practice-fed pairs (up to52 at the global opportunity ceiling), may repeat fixed contexts, and provides no transfer/learning proof. It is an implementation-scope alternative, not an accepted product decision or a validated optimization. Boundary fixtures must preserve absent/sparse pairs, wrong certificate text, every-prefix failure, n19/20/239/240/479/480, noncontiguous edits→unknown, and source deletion/reset/config changes. A more permissive per-sentence/checkpoint dose rule would change the promise and policy identity; there is no need to adopt it merely to make tests pass.

## Primary attribution and remaining research

P1 correctly labels all constants experimental product settings: spec lines65,170-172 and `policy/primary-evidence.md:1-57`. Independent narrow checks agree with its main attribution limits:

- [Dhakal et al., original author-hosted CHI paper](https://userinterfaces.aalto.fi/136Mkeystrokes/resources/chi-18-analysis.pdf), pp.3-4, collection/preprocessing/metrics:15 sentences, completer and error exclusions, separately omitted >5000ms IKI gaps, distinct error/correction measures. These are observational measurement choices, not a TypeForge test-count or coaching-threshold validation.
- [Yamaguchi & Logan, institutional author manuscript](https://research.edgehill.ac.uk/ws/files/20172048/YamaguchiLogan_2014a.pdf), abstract and manuscript pp.30-37, Experiment4: relocated-key practice and surrounding-sequence transfer contrasts. It supports attention to context without establishing intact-keyboard remediation or a three-word threshold. The manuscript warns it can differ from publication.
- [Baddeley & Longman, publisher abstract](https://www.tandfonline.com/doi/abs/10.1080/00140137808931764): indexed abstract reports hour-scale schedule comparisons. Direct access returned403 again. No new full-methods claim is made; it cannot validate ten30s tests.

No scientific attribution blocker was found in those limited claims. This is a narrow source check, not a broad literature review or a claim that no relevant evidence exists elsewhere.

**Unmeasured benefit:** recommendation frequency among all starters, burden/adherence, errorful/slow-user coverage, stability over real visits, usefulness versus intrinsic pair mechanics, false-target rates, fresh-text transfer and retained improvement. No simulated contrast, MAE, passing certificate or General fallback settles these.

**Future research:** compare the current timing signal against a separately specified error/curriculum approach; evaluate lower-burden participation or alternate gates only with explicit policy identity, all-start denominators and external/held-out transfer criteria. No collection, model fitting or threshold tuning is authorized or performed in this lane.

## Completion and scope

Owned output: this report, `probe.mjs`, `probe-results.json`, `probe-run.txt`, `regression-run.txt`, and `verification.json` under this directory only. Independent review remains **REVISE** on frozen P1 even though the new C2 witness demonstrates possibility. Root should route the two blocking corrections and relational fixtures back to P1, reconcile A2 and actual-Claude P2, then review any revised delta separately.

Task `task_ca690cf33109`, dispatch `ctx_83dfdde470f7`, terminal `term_43c58d54-273b-4cc8-93ae-5c3459664546`, run `run_1aeb00550f39`. Live full Orca receipt `91c76d4b-d321-4cc4-b17a-ecd2314ba7bb` reports requested/effective Codex `gpt-6.1-sol/high`, input accepted in the assigned child workspace; this is client launch evidence, not independent backend-serving identity. No helper workers, background services, browser sessions, user-data collection, production edits, dependency changes, push or global changes. Coordinator early finding message `msg_63f665e2ef6d`; root acknowledged frozen-review scope in `msg_1c7963f580f8`.
