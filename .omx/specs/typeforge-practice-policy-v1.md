# TypeForge baseline and experimental coaching policy v1

16 November 2026. **Stage 2A recommendation for root's architecture/critical review, not production implementation approval.** Owner P1; actual Claude P2 owns presentation; P3 owns bounded history primitives. Reviewed checkout `c65460b91ab2b310cb51f2f8cd4247d6c9f7c482`; application baseline identified by root as `b3fb14c`. No adaptive selector, instrument change, model refit, human study or deployment is implemented by these artifacts.

## Recommendation and meaning

Offer an optional, resumable **10 completed 30-second assessment tests** in one supported context before offering automatic suggestions. General 30s and the existing supported manual catalogue remain immediately usable, including during loading, errors and every abstention. Ten tests represent 300 seconds of scheduled test time, excluding setup, transitions, breaks and retries. This is a reversible **product target**, not a confidence level, diagnosis, scientific minimum or promise of benefit.

After the milestone, an experimental rule may suggest one **observed slower clean-copy pair** only if the timing, stability, source-context and actual proposed-block exposure gates below pass. Otherwise offer General/manual with a specific reason. This is a successful policy outcome. Do not promise that completing ten tests unlocks a particular target. Separate these claims:

1. Baseline participation: count of qualifying saved tests, capped at ten.
2. Descriptive timing: observed geometric means from selected eligible text.
3. Rule-based coaching: an experimental choice about what to practise next.
4. Learned timing prediction: existing frozen baseline/Ridge prediction experiment, independently identified.
5. Demonstrated improvement: not established by any preceding item, synthetic probe or pre/post change.

**Ten tests is not the existing ten-sentence window.** `profile.ts:selectHistory/appendHistory` keeps the newest ten eligible submitted compatible assessment sentences for existing prediction calibration. It can use sentences from interrupted assessments under existing semantics. This proposal does not alter that function, result eligibility, metric definitions, prediction inputs or retrospective comparisons. A new coach derives separate evidence from completed assessment/practice runs. No executor may replace one window with the other.

## Baseline counting contract

Supported initial context is exactly `schemaVersion=1`, `metricVersion=1`, `inputMode=flow-v1`, `durationMs=30000`, `language=en`, explicit `qwerty=true`, `corpusVersion=1`, plus the local context/epoch membership defined below. No duration pooling, v1/v2 mixing, legacy-Enter conversion or inferred keyboard declaration. General/manual works in other supported app settings, but those settings do not accumulate this baseline or automatic coach evidence. A future metric2 policy needs a new reviewed context/config identity; it must not silently inherit v1 calibration.

A test counts iff a **durably saved**, strictly valid assessment result in that context has `metrics.elapsedMs=30000`, `metrics.attemptedCharacters>=1`, `eligibleForProgress=true`, no run quality flags, a non-future completion time, and a unique source result ID. Result completion is established by the existing engine/result validator, never a button click or a counter increment. Do not require a submitted sentence, clean timing, minimum WPM, minimum correct characters or accuracy floor.

| Boundary | Baseline participation | Coach evidence |
| --- | --- | --- |
| Zero attempts; empty timeout | Does not count: `empty` | None |
| One genuine accepted insertion then timeout, even wrong | Counts, if otherwise valid; participation is a deliberately weak milestone | Usually none; ten such tests may complete the milestone and yield no focus |
| Ordinary mistakes, corrections/backspace, or final unfinished sentence | Counts if run integrity remains valid | Only existing submitted clean eligible sentences; never reconstruct timing from corrected/unfinished text |
| Abort/restart, safety stop, unsaved snapshot | Does not count | None |
| Interrupted/focus-lost or invalid-input result | Does not count | None, even earlier eligible sentences; existing assessment calibration remains unchanged |
| Paste/drop/composition rejected before engine admission | Does not itself count as a typing attempt; later genuine valid completion may count | Existing integrity flags govern; never relabel pasted/composed data as clean |
| Paste/composition/unsupported Undo accepted through conservative invalid-input path | Does not count when engine flags invalidate the run | None; do not clear flags to meet this policy |
| Duplicate result ID/page overlap/reimport with same ID | At most once; conflicting payload hashes fail integrity for that ID | At most once; never use a duplicate as independent support |
| Repeated prompt text in separate valid tests | Tests count | Repetition is not new context; deduplicate as specified below |
| Wrong duration, metric, corpus, language, input mode, declaration or context | Does not count here; existing history stays readable | Does not enter this bucket |
| Corrupt/unindexable/oversized source | Does not count; retained with diagnostics | Never becomes evidence; do not silently delete or weaken validation |

Use source IDs as witnesses, not a permanently incremented unlock flag. `counted=min(10, qualifying unique IDs)`; 0/1/9/10/11 yield 0/1/9/10/10. Completion count has **no age expiry**. Source deletion, reset and context change can lower/restart it. Compatible old 30s flow-v1 assessment records can count in the initial legacy-compatible context, regardless of their age; old evidence does not become fresh because it counted. Existing 60s assessments remain valid in their original cohorts but do not count here. Do not silently create a 30s copy or split a 60s result into two tests.

Ten tests can burden people, especially if repeated after a break. Keep progress across visits without consecutive-day requirements, expiry, forced retries or perfect-run gates. Users can stop baseline collection and practise General/manual indefinitely. A person making errors may finish participation while remaining outside clean-timing coverage: explain this as limited evidence, never personal failure. This policy does **not** solve error coaching or beginner curriculum support. Do not ask someone to keep taking tests until a suggestion appears.

## Local context, resume, deletion and reset

A browser origin is not a person or physical keyboard identity. A `contextId` is a local explicitly changeable grouping label, never inferred device identity. Initial bootstrap creates a default context and records `legacyCutoffCompletedAt`, its initial `legacyEpochId`, plus a data revision. Existing untagged sources at/before that cutoff may be admitted only to that default context **and that initial epoch** after ordinary settings validation. Resetting the default context does not re-admit untagged legacy sources. This is a disclosed same-local-context assumption, not verified historical identity. A new keyboard/person can choose **new context**. It creates a new opaque context ID/epoch and admits no old untagged records. Switching back may resume a retained context. No accounts or fingerprinting.

Subsequent runs capture context/epoch ID at preparation in a strict source-membership sidecar; changing context mid-run affects the next run only. Post-bootstrap sources missing membership are not automatically assigned to the active context. A sidecar write failure leaves the result readable but not counted for the new policy until its source membership is durably repaired from the still-known captured preparation; never guess membership after reload. Initial migration is idempotent and must distinguish pre-bootstrap legacy from failed new writes.

**Reset baseline** is non-destructive: create a new opaque epoch in the current context; results remain in History/export and frozen assessment records stay unchanged. Epoch membership, not completion timestamp alone, excludes an old in-flight run completing after reset. Reset does not reclaim or retag old sources. Deleting a source invalidates every derived witness/snapshot that cites it; next preparation rebuilds. Deleting all results produces zero progress; deleting the only tenth witness may produce nine. Do not preserve a sticky unlock. Deleting derived sidecars alone cannot falsify source evidence or delete result history; safely rebuild where provenance is known, otherwise abstain.

Persist context metadata and optional decision/exposure provenance in **new independently versioned IndexedDB stores**, not extra properties in schema-v1 `SessionResult`. Root/architecture must review the DB upgrade and transactions before implementation. Result write plus new source-membership write should be one transaction where feasible; if not, distinguish pending/membership failure explicitly. Ordinary source export remains valid readable legacy results only until a separately versioned optional coaching-envelope export is implemented. No silent import or recovery bypass.

The legacy app can read/export/delete untouched schema-v1 results and ignore stores it does not know, subject to its current IndexedDB version handling. An older app may fail `open` after a DB version upgrade; **do not promise downgrade compatibility** until engineering verifies it. Deletion from an old client can leave stale sidecars: source existence/hash revalidation makes them inert. Config/sidecar absence never invalidates a readable result. This is the explicit sidecar choice; no new result schema or bypass of unknown-field rejection.

Context metadata uses strict separate `typeforge-coach-context-schema-v1` records: one root `{schemaId,kind:root,activeContextId,sourceRevision}`, per-context `{schemaId,kind:context,contextId,activeEpochId,legacyCutoffCompletedAt:null|UTC,legacyEpochId:null|ID}`, and per-epoch `{schemaId,kind:epoch,contextId,epochId,createdAt}`. Reject unknown keys. IDs use the sidecar ID rules; only the initial context may have a nonnull cutoff/legacy epoch pair. Read only the active root/context/epoch during automatic preparation; an explicit context-picker operation pages retained contexts. Revision is a nonnegative safe integer incremented transactionally on all source/membership/deletion/reset/context mutations. If an uninstrumented older client writes, source point-read/hash checks are still required and coherent authority cannot be assumed from revision alone.

## One first signal: observed clean timing contrast

Choose timing rather than a mixture of timing and errors. The supported practice activity currently targets digrams; persisted first-attempt errors identify expected keys, not the exact mistyped transition. Mapping key error rates to pair weaknesses would add an unsupported inference and another selector. Keep error/attempt counts as diagnostics/coverage, never a hidden score component. An error-based future policy needs its own target/content/metric contract.

**Decision estimand:** within the eligible selected source text, is pair `p`'s geometric mean interval at least 25% longer than all observed *other* within-word lowercase pair intervals? This describes selected text, not an abnormal biological deficit, population percentile, causal trainability or recoverable WPM. Pair mechanics and word/passage composition can explain the contrast. No population prior, smoothing, corpus-frequency multiplier, regression residual or Ridge coefficient enters this rule.

### Concrete evidence and threshold table

All numbers in this table are experimental product settings. They suppress obvious sparse/no-effect decisions, bound work and require repeated contextual support; neither the papers nor simulations establish scientific adequacy.

| Parameter | v1 value and exact boundary |
| --- | --- |
| Recent source window | Newest **20** qualifying completed assessment **or practice** runs in the same exact context/bucket, with `now-30*86400000 <= completedAt <= now`, inclusive; tests used for milestone need not be recent |
| Source quality | Same integrity/completion/attempt rules as baseline; mode may also be practice. Protected evaluation/transfer probes are never admitted, even if otherwise compatible |
| Sentence eligibility | Existing `submitted && eligible`; nonempty valid finite timing aggregates; no invented timing for edited/partial text; existing interval filter remains `0 < ms <= 5000` |
| Repeated text | Keep the newest eligible occurrence of each `(corpusVersion,promptId,exact promptText)` across the window; verify text against the declared immutable bank. Same text under a second ID is also one context. A changed text under an existing immutable ID is invalid |
| Pair observation attribution | For candidate `p`, if an eligible sentence contains `p`, accept that sentence for this candidate only when its `pairs[p].count` equals all within-word lowercase occurrences of `p` in the prompt. Otherwise omitted timing positions cannot be attributed to particular words: exclude that sentence for this candidate, with a diagnostic. No summation of distinct word support from ambiguous aggregates |
| Pair support | At least **20** intervals of `p`, **80** intervals of all other pairs, **4** distinct source run IDs containing accepted `p`, **4** distinct target-bearing prompt texts, **3** distinct lowercase whole-word spellings containing `p` |
| Effect | `delta=targetLogSum/targetCount-referenceLogSum/referenceCount`; full-window ratio at least 1.25, tested as `delta + 1e-10 >= ln(1.25)` so exact mathematical boundaries tolerate binary64 arithmetic |
| Numeric no-effect tolerance | `abs(delta) <= 1e-10` is no effect; distinct from the practical threshold. The same numerical allowance applies only to log-threshold comparisons; it is not uncertainty or biological meaningfulness. Finite validation precedes arithmetic; values outside the existing interval domain never participate. Accumulation uses compensated summation in stable `(completedAt,id,promptId,pair)` order; uniform histories at every supported count still abstain |
| Stability | Sort retained sources chronologically; split accepted source-run IDs into oldest `floor(n/2)` and remaining newest half, keeping each run wholly within one half. Both halves need **8** target, **20** reference intervals, **2** target-bearing runs and `deltaHalf + 1e-10 >= ln(1.10)`. Reference-only accepted runs can supply reference support but do not substitute for target-bearing runs |
| Selection | Gate each pair; keep only pairs with an exposure certificate below. Highest full-window delta wins; exact ties use ASCII pair order. No corpus-occurrence multiplier |
| Retirement/switch | Recompute at each next-block preparation. Retire immediately if any gate/certificate fails, evidence expires or sources/config/context become invalid; another passing pair can replace it. No persistence grace, cooldown, hidden hysteresis or mastery claim. Half-window agreement is the only stability guard |

All eligible pairs other than `p` in candidate-accepted unique sentences provide reference counts/log sums; exclude `p` exactly rather than comparing the pair with a mean that includes itself. Distinct word counts derive from full matched eligible prompt occurrences; do not derive them from arbitrary user text. Reference-only sentences can contribute; support/run/context requirements always concern actual target occurrences. Zero reference, nonfinite arithmetic or invalid aggregation abstains. The half-window guards need not match whole-window context counts, but all full-window gates must pass.

Window admission counts completed runs **before** looking for clean sentences. A recent errorful run consumes a window slot; do not secretly reach arbitrarily far backward until clean data appears. Retaining only the latest occurrence per prompt can collapse many repeated tests to few independent run contexts. This deliberate conservatism is visible as abstention, not evidence of no underlying problem.

Practice evidence updates a **subsequent** block only after the source result and membership save. Starting block B captures config hash, context/epoch, source revision, witness IDs, coach snapshot and existing prediction snapshot. B's own data cannot select B. Completing B may affect C; it never rewrites A/B text/settings/predictions, prior calibration or assessment benchmark artifacts. The existing assessment-only ten-sentence calibration stays assessment-only. If future protected probes are introduced, their membership must explicitly exclude them from coaching as well as tuning; no new human collection is authorized here.

## Exposure, finite prefixes and diversity

Do not call a 2:1 passage cadence enrichment. Define `G(p)` as the exact number of within-word lowercase `p` opportunities divided by all characters (including spaces, excluding synthetic inter-passage separators) in the complete uniform General bank. It is a declared **bank-density comparator**, not an equal-time counterfactual or a guarantee about a random General prefix.

Before offering a target, the proposed ordered bank must carry a **prefix certificate**, computed from its actual text, with these checks:

- At least 240 characters in the plan; no adjacent repeated prompt, at least 4 distinct target-bearing prompt texts available and at least 3 distinct target-bearing whole words in the bank.
- First complete target occurrence ends at/before character 20. For **every integer concatenated-prefix length `n=20..planLength`**, opportunities fully contained in that prefix satisfy `100*opportunities/n >= 1.25*(100*G(p))`. Verify all positions, not only 20/40/80/120/240 or full cycles. Each passage's words remain intact and no cross-passage pair is counted.
- By prefix 240, at least 3 distinct target-bearing whole-word spellings have been fully traversed; at least 4 distinct target-bearing passages are traversed by prefix 480 if the plan is that long. Repetition cannot satisfy those counts. No prompt may repeat before all available distinct target-bearing prompts have been used once. The plan is finite and bounded by existing sentence/attempt envelopes; exhausting a plan triggers next preparation/General, never uncertified cycling.
- If a target cannot meet this exact finite-prefix/context contract in the available bank, return `exposure-unsupported` (or `corpus-coverage` for insufficient bank contexts) and General/manual. Do not expand corpus, lower gates or relabel General as targeted to make a counter succeed. Manual remains an explicit choice and receives honest dose facts; it need not pass automatic-target gates.

**A partial run can end before any opportunity.** No policy can promise positive target exposure for zero characters or before a pair is traversed. Record the actual contiguous expected-text frontier traversed by genuine first attempts, `n`, and opportunities fully contained therein, per passage, using ephemeral position tracking available at runtime. Sum those reached prefixes; edits do not double count. If noncontiguous edits prevent a proven frontier, store `exposureStatus=unknown` and never substitute planned dose. No raw key log is required; counters/first-attempt frontier and distinct word/passage counts suffice. This future instrumentation belongs to a reviewed sidecar, never backfilled from final response length.

For actual `n<20`, label `too-short-to-evaluate`; for `20<=n<240`, report actual density and observed word/passages with `partial-context`, even if density passed; at `n>=240` test density and 3-word criterion against reached prefixes. Four-passage criterion is evaluated when `n>=480`. A run meeting planned but failing realized density/context is `below-contract`; it is still valid baseline participation if the baseline rules pass. Do not call it successfully delivered targeting. Actual exposure is independent of clean timing eligibility: making errors does not erase attempted exposure. Every numerator/denominator is reported separately from timing support.

The certificate is deliberately strong and may leave no automatic focus for a particular history/corpus. General/manual-only is the correct fallback. Bounded probes are feasibility examples, not a sampler implementation, human yield estimate or retained improvement evidence.

## Independent config, provenance and strict schemas

Machine config and exact-value JSON Schema live beside this spec in `docs/implementation/2026-11-16/baseline/policy/`. `schemaId=typeforge-coach-config-schema-v1`, `policyId=clean-pair-contrast-v1`; `configId=sha256(canonical UTF-8 JSON of the entire config)` using recursively sorted object keys, JSON scalar encoding and no whitespace. Do not hash its own identity into itself. A threshold/context/bank-density definition change requires a new policy/config identity and fresh review/fixtures; a future permitted parameterized schema must still reject unknown fields and invalid ranges.

`baselineKind=observed-unshrunk-complement` is defined here and has **no dependency on model.json**. Missing/malformed Ridge plus valid coach config/evidence may still offer a suggestion. Valid Ridge plus missing/malformed/incompatible coach config offers no automatic suggestion. Candidate failure cannot switch coach policy/version. Existing prediction fallback keeps its separately documented behavior; this stage does not repair or repackage predictor artifacts.

New sidecar schema identity is `typeforge-coach-sidecar-schema-v1`, separate from result and config schemas. Its strict shape is:

```
source-membership-v1 = {schemaId, kind, resultId, resultSha256,
  contextId, epochId, capturedAt, purpose: ordinary|protected-probe}
decision-v1 = {schemaId, kind, resultId, resultSha256, policyId, configId,
  contextId, epochId, preparedAt, now, sourceRevision, sourceIds,
  baselineWitnessIds, signal: clean-pair-log-contrast, outcome,
  reason, focus: null|{pair, targetCount, referenceCount, sourceRuns,
    promptContexts, wordContexts, targetLogSum, referenceLogSum,
    halves:[{targetCount,referenceCount,targetLogSum,referenceLogSum,sourceRuns},...],
    certificateId}, exposure: null|{certificateId, reachedCharacters,
    targetOpportunities, distinctWords, distinctPassages, status}}
```

`kind` determines the required keys; reject extra/missing keys, nonfinite numbers, negative/noninteger counters, duplicate IDs, more than 20 coach source IDs/10 baseline witness IDs, invalid enum/UTC timestamps, malformed 64-character lowercase SHA256 hashes or pair outside `/^[a-z]{2}$/`. Halves has exactly two items; `sourceRuns<=20`, contexts/counts obey existing envelopes. Reasons/outcomes are the finite enums below; focus is nonnull iff outcome is `suggested`; reject incompatible combinations. `capturedAt/preparedAt/now` are UTC ISO strings; source result hash uses canonical complete validated result JSON, not a response-text-only digest. Result ID is the join key. Source hashes are integrity/version checks, not anonymity or signatures. Schema identity denotes this fully specified contract; root must implement a strict validator and negative fixtures before any sidecar writes.

A decision is an immutable **historical explanation**, not current authority: every source/witness is existence/hash/context revalidated for new preparation. Invalid/stale sidecars may be discarded and rebuilt without touching result JSON. No profile stores copied responses, raw keystrokes or new private writing. Existing source results already include responses; do not call them anonymous. Export/upload, telemetry and recruitment remain out of scope.

Preparation and active-run snapshots stay in memory before a result exists. At successful completion, attach the captured decision to that new result's ID/hash in its own sidecar transaction; do not fabricate a hash for an unsaved future result. The machine sidecar schema covers structure/enums; semantic validation additionally checks full/half count relationships, source/witness existence and hashes, context membership, outcome/reason consistency and certificate recomputation. JSON Schema alone does not prove policy authority or statistical validity.

## Bounded read, time and race semantics

Use P3's reviewed Stage1C API: at most 25 examined rows/4 MiB per slice and 500 examined rows/16 MiB per automatic lookup, invalid/incompatible rows included. Baseline and coach queries share this automatic preparation budget, including witness point reads and sidecar validation; do not hide separate 500-row scans. Yield between slices/after 8ms cooperative work; report non-preemptible single-record overshoot. No hard heap/latency promise.

**Milestone proof:** a revalidated set of ten valid present witness IDs proves the capped count is ten without scanning all history. Cache is only an ID/hash hint. Re-read every witness in the current revision; source deletion/rewrite invalidates it. With fewer than ten, the number is exact only when the context/epoch candidate range is exhausted. Otherwise expose a lower bound and `baselineProofComplete=false`, never an exact nine/ten from a truncated scan. Older qualifying rows beyond the 500-row budget are **unknown**, not absent. Explicit user continuation may resume bounded slices; it never blocks General/manual. Do not manufacture a persistent unlock to evade the scan budget.

**Coach proof:** completeness means all rows newer than the 20th admitted compatible in-window source were examined, or the time/epoch range was exhausted with fewer than 20. The indexed order is `(completedAt,id)` newest-first. A partial read cannot silently backfill from older rows. If the budget ends before that stopping proof, `evidenceScanComplete=false`, outcome `pending`, reason `scan-incomplete`; no diagnosis and no suggestion. A completed milestone and incomplete coach scan can coexist. Unindexable invalid rows are excluded with explicit diagnostics, not presumed valid missing evidence.

P3's generic `scanHistory.complete` means full bounded-index traversal, not this narrower policy proof. The integration owner must implement a separately named stopping proof over `readHistorySlice`, not reinterpret an incomplete generic result as complete. Final admission revalidates all selected source/witness IDs, hashes and active context metadata in one coherent read transaction (within the shared budget). If that transaction/revision proof cannot complete, return pending/unavailable. Preparation is an as-of snapshot; mutations after admission affect the next preparation under the freeze rule.

At each preparation capture wall-clock `now` once in UTC integer milliseconds and hold it fixed for cutoff/decision; use the monotonic engine clock for run duration. Exactly 30 days is included; one millisecond older is excluded. Future completion timestamps are excluded with `future-time` diagnostics until a later preparation catches up. Clock rollback can yield fewer valid records/General; a clock jump forward may expire evidence but never erases milestone progress. Do not claim server-certified time or infer elapsed active typing from wall time. Time passage can retire evidence at next preparation only.

Each asynchronous request captures `(preparationGeneration,sourceRevision,contextId,epochId,configId)`. Reject a late result if any differs, navigation/restart occurs, or typing has begun. Deletion/reset/context change advances revision and cross-tab notification invalidates next preparations; revalidate authority before admitting a snapshot. Active snapshots remain frozen. Cross-tab notification is not a substitute for read-time source verification/atomic revision checks. If storage cannot prove a coherent revision across the preparation, abstain rather than issue a stale focus. Root must integrate source writes/deletion/context revision ownership; P3's bounded read alone does not provide that lifecycle.

## Output and reason precedence

Proposed non-UI interface for Claude/root:

```
BaselineStatus {policyId, configId, context, target:10, counted:0..10,
 baselineProofComplete, evidenceScanComplete, pendingSave,
 otherContextCount: integer|null, state, reason,
 focus?: {pair,pairGeometricMs,referenceGeometricMs,observations,
          referenceObservations,sourceRuns,promptContexts,wordContexts},
 witnessIds, sourceRevision, exclusions}
```

Other-context count is `null` if not exactly examined; do not spend an unbounded scan merely to display it. `counted` with incomplete proof is a lower bound. Explanation strings and announcements belong to actual Claude; these are semantic fields.

Evaluate global failure precedence: `policy-invalid`, `storage-unavailable`, `context-unavailable` => `unavailable`; incomplete milestone/evidence query => `pending / scan-incomplete`; proved milestone below ten => `not-started` (0) or `in-progress` (1..9), `baseline-incomplete`; milestone ten plus no recent sources => `complete-insufficient / stale-evidence`. Before ten, no automatic suggestion even if timing passes.

With ten and complete recent evidence, evaluate pair gates in order: support, context diversity, stability support, full effect, half-effect agreement, bank contexts, prefix exposure. Select any fully passing candidate regardless of failure of other pairs. If none passes, report the reason at the **furthest gate reached by any pair**, deterministic precedence for ties: `too-few-observations-for-any-pair`, `insufficient-context-diversity`, `unstable-evidence` (half support), `no-effect`, `unstable-evidence` (half contrast), `corpus-coverage`, `exposure-unsupported`. This makes reason selection reproducible without implying a fully searched history when truncated. Preserve all exclusion diagnostics for inspection.

`complete-ready` has a focus and internal outcome `suggested`; all complete-insufficient outcomes have focus=null/internal outcome `general`. Historical invalid-data exclusions may coexist with valid bounded proof; storage rejection means unavailable, not empty. Pending save is not counted, and a failed save never increments an optimistic permanent counter.

## Evidence, alternatives and limits

The local [learning review](../../docs/reviews/2026-11-15/learning-review.md) and [ML review](../../docs/reviews/2026-11-15/ml-review.md) establish prior source mechanisms, sparse support, repeated-context and cadence risks. Their old numerical no-effect bug was subsequently repaired; this policy preserves uniform-history abstention and adds a meaningful effect gate. It does not repeat offline training or treat historical defects as unrepaired current observations.

The [primary-evidence report](../../docs/implementation/2026-11-16/baseline/policy/primary-evidence.md) records access depth and limitations. [Baddeley & Longman (1978)](https://doi.org/10.1080/00140137808931764) concerns hour-scale postal typing training, supporting a scheduling question rather than ten short-test necessity. [Yamaguchi & Logan (2014), author manuscript](https://research.edgehill.ac.uk/ws/files/20172048/YamaguchiLogan_2014a.pdf) found context-dependent transfer in altered-key learning; it does not establish intact-keyboard remediation or the three-word cutoff. [Dhakal et al. (2018), author paper](https://userinterfaces.aalto.fi/136Mkeystrokes/resources/chi-18-analysis.pdf) distinguishes error measures and observational filtering; its 15-sentence procedure is not ten timed tests, and its 5s interval filter is not a scientifically optimized TypeForge eligibility rule. None validates our 20/80/4/3, 25%/10%, 20-run/30-day or 1.25x exposure values.

Why these product settings: 30s reuses an existing supported duration and limits participation burden; ten preserves Owen's concrete candidate while separating coverage. Twenty recent sources leave room for practice feedback without unbounded aggregation. Twenty/80 observations and four run/prompt contexts rule out a few repeated intervals; three words avoids one-word pseudo-diversity. A 25% observed contrast plus same-direction 10% halves resists tiny numerical differences and one-sided histories. Thirty days limits indefinite stale coaching without expiring participation. Prefix certification prevents a full-cycle average from misrepresenting short runs. These are transparent safeguards, **not statistical confidence intervals**, validated minima or guarantees against false targeting. Half-windows are correlated and composed of selected text; no p-value is claimed.

Rejected for v1:

| Alternative | Reason |
| --- | --- |
| Mandatory baseline before any typing | Contradicts immediate General/manual usefulness and adds burden |
| Ten clean tests or accuracy/WPM threshold | Selects away error-prone/slow users who need practice; unnecessary for participation |
| Ten sentences treated as ten tests | Changes the user's proposal and existing calibration meaning |
| 10x60s / 10x120s | Doubles/quadruples scheduled burden without evidence that it resolves coverage; existing 60s assessment cohorts remain preserved |
| Unlock at one/five tests or whenever one pair reaches eight observations | Could reduce burden, but remains sparse and would change the concrete ten-test milestone; future reversible usability alternative, no superiority claim |
| Pool all durations/input/metric versions | Unverified invariance; contaminates cohorts. Fragmentation is explicit and General/manual stays available |
| Repeated prompts as independent contextual evidence | Familiarity and the same words can manufacture support; latest-context dedup is conservative |
| Error-rate plus timing composite / Ridge residual | More inferred meanings, new target attribution and unvalidated policy complexity; not justified by MAE |
| Confidence intervals from saved log sums | Within-source variance/correlation is unrecoverable; cannot invent precision |
| Existing corpus-frequency score / 2:1 cadence | Corpus frequency is not demonstrated usefulness; full-cycle cadence can reduce common-pair dose |
| Sticky ten-test unlock or immortal focus | Survives deletion/reset/freshness incorrectly; revalidate source witnesses and retire on failed gates |

Bounded sensitivity fixtures/probes in the artifact directory show threshold sensitivity and corpus feasibility only. No participants, private data, learning gains or actual adherence/yield are measured. A future policy comparison should include all starts/abstentions and fresh-text transfer, but no study/refit is required or authorized by this document.

The [current source probe](../../docs/implementation/2026-11-16/baseline/policy/coverage-report.md) makes the burden/coverage tradeoff concrete: the 40 assessment texts are 37–53 characters long. At an artificial 10 WPM/25 insertion slots per 30s run, none completes a sentence, so all ten tests can count participation while yielding zero clean timing. In one seeded 60-WPM ideal scenario only one pair meets the proposed count/context ceiling after latest-text dedup, before effect, halves and exposure; this is not a forecast for real typists. Repeating one queue can inflate raw intervals while failing independent context support. These results argue for preserving the truthful fallback, rather than relaxing thresholds or excluding struggling users to force an unlock.

Finite-prefix results are also restrictive: illustrative `th` and `he` plans can pass selected checkpoints and still fail at characters 26 and 25 respectively. `ag` cannot meet this policy with whole existing prompts (earliest target ends at 24, and only three target-bearing passages exist); `au` has one word/passage and `zz` none. A fixed `br` plan provides a bounded feasible certificate at 240/480-character minimum lengths; that does not establish an observed timing target or an optimal sampler. The helper checks every integer prefix through the actual whole final passage, not only the requested minimum. Arbitrary-order failures do not establish global impossibility except the stated corpus bounds.

Remaining genuine product questions for later evaluation: Is the five-minute optional milestone worth its burden versus fewer tests or General/manual alone? Does an observed slow-pair contrast identify an actionable target after word/passage mechanics are accounted for? Would an error-focused curriculum serve excluded users better? Do the declared contexts reflect users' real keyboard-sharing behavior? These are not values an executor should silently tune. Root can accept the concrete conservative experimental policy, or retain General/manual-only if independent review rejects automatic targeting. Actual Claude decides how each outcome is explained.
