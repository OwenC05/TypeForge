# C2 r2 contract acceptance — APPROVE within the C2 lane

18 November 2026. **APPROVE the numeric/policy/producer contract delta for implementation admission**, on exact author **`c6a8a806ec98c6015e3e8819698ff5b19a97ad98`**, root import **`0c25a8b1f1f72c613c411864ffcfb02b9e3db236`**. No additional C2 amendment is required. This is not production acceptance, an A2 lifecycle/interface approval or an actual-Claude design verdict. Root must reconcile those independent lanes before declaring the combined contract admitted.

Original C2 REVISE `87fe85ecb703a255faea046a2294419be7d5dcff` and r1 REVISE `3c9342c2eb3758dfa9d3028f8adabf0ab470eeca` remain unchanged. r2 resolves this lane's clock-bound and summary-only scope blockers without lowering signal thresholds. A distinct finite source/validator and terminal state are implementable proposed contracts; their missing production code is expected at this gate, not a reason to reject the contract.

## Exact inputs and runnable evidence

References below are at `c6a8a80`. `policy/` abbreviates `docs/implementation/2026-11-16/baseline/policy/`; `spec` is `.omx/specs/typeforge-practice-policy-v1.md`. [input-manifest.json](input-manifest.json) records Git blob IDs/raw SHA256 for the spec, reviewed artifacts, producer, validators and exact old C2 trace. Important blobs: spec `061f00b83033a911d9eaeece4b3caf249f31f5ab`; revised relational checker `6f8c9cc56d19411b2a8b895213e1e700d04d9ecc`; finite contract `9d4a35a83dae6e9c26bbacd26799633ccc734014`; interfaces `8fc8d3d1ce1e5348a456e4852713af080672a2fd`. Author/root policy artifacts compare equal.

```text
node --check docs/implementation/2026-11-16/baseline/policy-delta-review/r2/review.mjs
node docs/implementation/2026-11-16/baseline/policy-delta-review/r2/review.mjs
```

The runner extracts exact Git modules into ignored local `r2/input/`, so it does not modify author sources or depend on this child checkout having imported the revised policy. [results.json](results.json) and [run.txt](run.txt) retain **72 C2 assertions passed**, plus **98 author r2 checks and108 author relational checks replayed**. Replays are not additional independent checks. New tests use independently selected mutations, expected outcomes and the previously committed C2 trace against the author functions under review. The finite forwarding oracle is a contract fixture over the unchanged real producer, not a new adapter or accepted validator. No corpus search, broad audit, literature search or browser service was run.

**Producer/validator provenance:** the author branch's `storage.ts` predates root's accepted reader merge; it is not claimed byte-identical to the accepted P3 reader. The harness therefore also extracts exact root `0c25a8b:storage.ts` and checks the relevant timed source fixtures through that public validator. Both accept the same timed/lagged/ordinary-practice fixtures and reject the separate finite envelope. Root and author engine blobs are equal. This bridge checks result compatibility only; it neither repeats H3's low-level byte audit nor certifies the future storage consumers.

## Disposition of the prior findings

| Prior finding | r2 evidence / disposition |
| --- | --- |
| Invalid metric1 aggregate-to-elapsed necessity | **Closed.** Spec:82 and checker `runIssue` remove the entire time inequality, without a replacement tolerance. Replaying the exact C2 stored event trace yields the identical canonical valid result; the1ms first-input lag is now admitted. |
| Unsupported domain/complement inputs | **Guards retained.** All-pair occurrence/count/log/key checks and run attempt/correct-count envelopes remain. Absent `zz`, excess count, impossible lower/nonfinite logs, missing key and contradictory run attempts reject. The original legacy-valid fabricated-complement history produces no focus while still counting ten participation sources. |
| Disconnected qualification/certificate | **Closed previously, preserved.** Connected `he` remains target28/reference543,10 source runs,19 prompt texts,4 words; halves10/234 and18/309 with5 target runs each. The same501-character certificate passes. Replayed below/at/above250ms boundary, latest-text exclusions and reference-only halves retain their r1 meanings. No corpus or threshold was changed. |
| Summary-only scope cannot complete objective | **Closed.** New enabled config/schema and spec:9,165,207 require the ten-test gate, rolling summary and supported-practice pilot together. Defensive disabled/unavailable/no-target branches remain; summary-only delivery is no longer completion. |
| Cached ten conflated with newest summary | **Closed at helper/contract level.** `baseline(...,{exhausted:false})` proves capped10 but returns no summary; explicit `newestRangeProved:true` permits the median. Production range proof remains A2/integration acceptance. |
| Finite exhaustion and fake timed result | **Contract resolved; implementation required.** Immediate `plan-exhausted` with actual elapsed, no wrap/wait/fake30s result, a separate strict envelope/validator and explicit source exclusions are specified. |

### Clock/filter and enablement evidence

The committed prior trace is loaded from `3c9342c:policy-delta-review/review-results.json`, not recreated from the author's r2 example. First-input lags0/0.01/0.1/1ms retain0/0/1/1 eligible sentences; every run passes the retained count envelope. The1ms case's canonical source hash equals the original C2 result whose observed interval lower bound was30000.030000000028ms with elapsed30000. Removing that unsupported rejection does not authenticate aggregates; the residual trust limit is explicit and still appropriate.

Author endpoint fixtures at4999.999/5000/5000.001/0.25ms replay successfully: the >5000 interval alone is filtered, positive sub-ms observations remain usable. Independent current-producer final-boundary actions at deadline−0.001/exactly deadline/deadline+0.001 submit only in the first case; timeout wins at/after the deadline. No old timestamp or metric is rewritten.

Enabled config canonical SHA256 is **`de43c1c2266364e8c859ac3abc61126590fbec2d10be9b7e0e14616770411995`**; catalogue remains **`17de69ffe905a28e8e00ad65d1494a003b080bcd2a894a81fea5c28351594a25`**. Config and exact schema both require enabled=true under new identities. Independent deep comparisons with r1 show baseline, exact context, window, support, effect, stability, exposure and work limits unchanged. This includes20/80 observations,4 runs/4 prompts/3 words,1.25 full/1.10 half contrasts,20 runs/30 days and the same finite templates. The schema inspection is narrow identity evidence, not standards-complete JSON Schema validation.

## Finite producer/source semantics are implementable

`policy/finite-adapter-r2.md:9-13,25-37` and `interfaces-r2.ts:145-169` specify a realizable instrument extension:

- Advance monotonic time before a final submission. A timeout at that action produces the ordinary timed result, without inventing the last commit. Otherwise, after the last certified commit, atomically enter a new terminal state before another modulo prompt is queried. Subsequent edit/tick cannot add text/time; a new run needs a new ID/snapshot.
- Keep stopped/aborted outcomes distinct. Keep existing interruption/invalid-input flags and edited/repeat sentence semantics. A flagged finite end does not become a clean timed completion; Claude's flagged explanation has precedence. These rules do not require a new timing metric or changing existing cohorts.
- Retain existing actual-time WPM/accuracy formulas, with positive finite actual elapsed<30000. Use the separate `typeforge-finite-practice-result-v1` envelope and strict validator, not a cast to schema1, duration padding, an invented flag or a changed selected duration. Enforce exact plan identity/order/count, scalar/byte/sentence limits, metrics, chart, flags/null diagnostics and finite arithmetic; very fast finite figures cannot be constrained by the old30s WPM bound.
- Omit `practiceFocus`, `manualDrill` and `sourceAssessmentId` on both new timed coach sources and finite envelopes. Active policy provenance belongs to the admitted snapshot; historical old fields retain their original meanings. No legacy selector may become a fallback coach authority.

The independent forwarding oracle submits the whole `he` plan and retains12 sentences/501 correct characters over512ms. It refuses a further forwarded action and freezes its captured output. The unchanged engine still returns no early timed result; both author and root timed validators reject the proposed finite envelope. This does **not** establish that engine modulo lookup, new terminal ticks or finite validation are already fixed in production.

Edited traversal preserves one deletion and first-sentence ineligibility; interruption remains flagged; invalid input remains flagged with null accuracy. Pace equals existing `correctCharacters*12000/actualElapsed` in each case. Clean accuracy retains the producer formula. Actual response-limit and abort examples remain `stopped`/`aborted`, with no saved timed result. All finite fixture variants remain ineligible for timed policy evidence and contain none of the prohibited legacy provenance fields. No figures or policy authority are inferred from these proposed envelopes before the new validator exists.

## Ordinary timed feedback remains distinct from early exclusion

Independent application-engine fixtures add20 later eligible ordinary30s practice results to the connected assessment history. They replace the recent coach window and reduce retained target support from28 to8; the prior supported focus retires. This particular synthetic outcome is a support/dedup shortfall, **not an observed learning effect or a measured human improvement**. All assessment baseline/median witness IDs remain unchanged, and existing assessment calibration receives the same assessment-only history. The ordinary practice records require no `practiceFocus`/manual provenance spoof.

Adding a clean early finite envelope instead changes neither coach-window IDs nor baseline/median IDs. The contract also requires a distinct finite history/export/recovery branch, not passing finite sources to `selectHistory` or the old timed validator. Source presence and captured membership preserve recovery lineage, not evidence eligibility. The unknown actual-dose boundary is retained; expected plan arithmetic is not realized exposure.

## Remaining implementation acceptance and dependencies

**No new C2 correctness blocker was found.** The following remain required before production acceptance, not reasons to reject this implementable numeric/producer contract:

1. E implements the real finite terminal, no-next-query transition, immutable terminal edit/tick behavior and separate finite validator. Test clean/edited/repeat/flagged input, deadline precedence, abort/stops, metric/diagnostic/chart edge cases, zero/nonfinite values, plan/hash/order mismatch, extra fields and legacy provenance spoof attempts. Preserve the unchanged schema1 timed validator and metric1 definitions.
2. D implements strict enabled identity/config/catalogue/certificate resolution and the pure source/half/summary selector. Run connected and no-effect cases through actual implementations, including missing/malformed Ridge versus valid/invalid coach config. No gate may be bypassed by model availability or an old Suggested result.
3. C/F integrate the SavedSource union, original capture, pending/retry/delete/reset behavior and real coherent authority under A2/H3 acceptance. Demonstrate ten durably saved assessments → admitted certified Suggested block → truthful timeout or early end → save/history/recovery → next preparation only. Ordinary eligible timed practice must affect that next preparation; early finite sources must not.
4. Root/actual Claude independently accept the visible flow, end/flag precedence, immediate General30s and remembered-kind behavior. No UI/copy/design verdict is made by C2.

Root message **`msg_6f2007e1d37e`** assigns A2 three separate interface questions: legacy-origin metadata/attestation in ProjectionInput, proof-bearing pure projection before supplied final proof, and durable revision-overflow non-admission. They are not reproduced or dismissed here. This C2 APPROVE does not clear those seams; combined interface freeze/implementation admission awaits A2's final disposition and root reconciliation. Likewise the finite oracle does not certify actual storage or production adapter behavior. Human reach, target usefulness, realized dose, false targeting and learning benefit remain unmeasured.

## Completion receipt

Task `task_9ad79c08bbe5`, dispatch `ctx_04ba90a3b9d1`, terminal `term_43c58d54-273b-4cc8-93ae-5c3459664546`, run `run_1aeb00550f39`. Full live receipt `7cf2a216-42b9-4f82-985c-92c77ab53bf2` reports Codex/model `gpt-6.1-sol`, live exact-worker observation, connected reused terminal and requested capable/high work. Reuse launch model/effort fields are null; effective effort/backend-serving identity are not independently proved. No settings/provider/account change is made or inferred.

Only new `policy-delta-review/r2/` artifacts are changed; prior reviews and author files stay frozen. No helpers, production/spec/UI/package/global changes, new dependencies, browser service, data collection, model fitting, deployment or push. Stop condition met: the four assigned C2 deltas have a grounded verdict and runnable bounded evidence; no further corpus or broad test expansion is needed.
