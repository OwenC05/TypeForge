# A2 authority delta: APPROVE for contract implementation admission

18 November 2026. **APPROVE** the exact S1–S3 corrections in `f7ddfdde280ee6ae6fe26b4dd2011d01dd8085de` and the combined architecture contract for implementation admission. No further architecture contract amendment is required before D0. This closes the three blockers from `eb69f1f8a95f4485d65c6520c953e19d5b006bce` for this corrected revision; the earlier reports and REVISE verdicts remain unchanged historical evidence. This is neither production acceptance nor an OMX/Ralplan authority claim. Root still owns the separate actual-Claude contract reconciliation before freezing D0.

## Exact scope and result

- Corrective author: `f7ddfdde280ee6ae6fe26b4dd2011d01dd8085de`; root import `3caadca1b045e470b9ae4773a61b9c544ebf66bc`.
- Root review brief: `799981b4abaface4ffb926d5bc0a4effaafb61ee`, `docs/implementation/2026-11-16/baseline/task-authority-delta-review.md`.
- Before-contract comparison: `c6a8a806ec98c6015e3e8819698ff5b19a97ad98`; exact prior A2 finding/report: `eb69f1f8a95f4485d65c6520c953e19d5b006bce`; original A2 `6418bcc3dd1cd31797a051e9effec48cbe7ecb9e` also preserved.
- C2 numeric/policy/producer approval `8ad96e12cc2f3313bb06a46c40c3206555997c82`, accepted P3/H3 primitive and actual-Claude evidence retain their separate scopes. No corpus, byte, numeric, finite-result, UI or application audit was repeated.

Reviewed the exact `authority-delta.md` and changed spec/interface/lifecycle/lease/probe files through Git. Short references below are to `docs/implementation/2026-11-16/baseline/policy/` at the corrective author hash, not a mutable working copy. A focused diff verifies that `typing-app/client/`, config/schema, catalogue, numeric `revision-check.mjs` and `finite-adapter-r2.md` are unchanged from the preceding author revision. Enabled config identity remains `de43c1c2266364e8c859ac3abc61126590fbec2d10be9b7e0e14616770411995`; catalogue remains `17de69ffe905a28e8e00ad65d1494a003b080bcd2a894a81fea5c28351594a25`.

## S1: explicit validated metadata — closed

`interfaces-r2.ts:140–146` now requires `metadata: Metadata`; `lifecycle-r2.md:9,50–52` assigns C's already charged validated metadata to the input and retains pure legacy classification in D. Metadata database/default-context/active-epoch/revision must agree with input authority, actual proof and each complete range authority. The proof selection binds the whole metadata value, including legacy epoch and cutoff.

The independent witness reuses the valid lagged source from the author fixture. Its old authority-only views remain identical across initial-epoch, changed-legacy-epoch and earlier-cutoff worlds. Explicit metadata now distinguishes all three and supplies the required true/false/false legacy decisions. Missing current membership still cannot acquire legacy origin. This resolves the information deficit without a new read, store, scan or per-source origin-attestation infrastructure.

## S2: actual proof, output order and continuity — closed

`interfaces-r2.ts:59–80,140–152` adds nullable `finalProof`, compact `ProofSelection` and exact proof continuity into admission. `lifecycle-r2.md:50–60` now fixes the call order: C gathers/validates/clones/freezes/hashes under the single ledger, C completes the actual final storage proof, then D derives proof-bearing components/candidate using that supplied proof. Pre-proof computation stays provisional and unpublished. Null/failed proof cannot produce a proved milestone, median, focus or candidate; unproved deletion cannot leave provisional ten presented as a current lower bound. Pending safe zero or unavailable count=null is explicitly allowed.

The binding is sufficiently concrete: full metadata and captured now; ordered source refs with partition/kind/ID/canonical hash/time; exact membership values; component ranges, including incomplete/not-requested states; exact method/config/authority and canonical actual proof-completion time. C validates/hash-binds sources; D checks corresponding source/membership semantics. The revised lifecycle also checks complete-range authority agreement, preventing a copied but mismatched range from acquiring proof merely through selection equality.

A successful method label, equal scalars, object shape or object identity does **not** prove a transaction occurred. Only C's successful actual final barrier/fallback creates the proof. D propagates that same object; C passes it unchanged into final local admission. The contract explicitly preserves this provenance/continuity distinction and prohibits historical/deserialized/reconstructed proof authority. The independent witness models that boundary openly; it checks null failure, exact supplied-object propagation, metadata cutoff/membership/range substitution, a scalar-identical replacement, local start/generation/config/database changes and safe pending zero. It does not claim to execute the future storage producer or policy functions.

The compact selection can reuse existing frozen preparation refs/memberships rather than copy raw source payloads or persist evidence history. It adds no IndexedDB requests or second budget. The actual barrier read remains charged/reserved; coherent fallback still must fit the same allowance or abstain. Source/config hashing remains outside live transactions; the final local generation/epoch/config/database/pre-insertion checks remain before publication/admission. As-of semantics and active snapshot freeze are unchanged.

## S3: persistent MAX sentinel and honest reset — closed

`lifecycle-r2.md:15,54,58` now reserves MAX_SAFE_INTEGER as durably non-admitting while the metadata schema remains structurally readable. Capture, preparation and either final proof require revision **below** MAX. The corrected actual author relation rejects MAX on either side, including equal MAX. A successful mutation at MAX-1 atomically commits its change plus MAX and disables optional authority immediately; failed transactions preserve both data and revision. At MAX ordinary save/recovery/delete/export can continue with MAX retained, while no new capture/admitting membership/proof or automatic authority recovery is granted.

`interfaces-r2.ts:189–192` replaces an apparently always-usable reset Authority with `EpochReset`: usable committed reset, committed-but-exhausted authority=null, or failed/unavailable authority=null. Reset from MAX-1 can honestly report committed exhaustion; reset already at MAX cannot establish a new usable epoch. No wrap, lowering, extra persistent state, silent bootstrap or replacement database is needed. Actual destructive recreation remains outside the pilot and changes lineage.

Independent state witnesses cover MAX-1 validity, the exact corrected relation's equal-MAX rejection, failed-reset rollback, reset reaching MAX, reset already at MAX and ordinary write/delete/recovery followed by reload/cross-tab observation. Sentinel state remains persistent and non-admitting independently of notifications or local memory. Runtime validation remains necessary: neither the number type nor structural metadata validation alone enforces this semantic distinction.

## D0 and implementation readiness

`implementation-dag-r2.md:18–20` now explicitly places these corrections before D0 and keeps C/D/E write leases disjoint. C owns actual gathering/hashing/storage proof and durable sentinel operations; D owns metadata-based legacy classification and post-proof projection; E's finite contract is unchanged; actual Claude retains the sole app/UI/recovery lease. C's runnable acceptance depends on D's real validation/projection modules and E's real finite-result validator. Parallel editing does not justify stubs, invented signatures or a passing claim before those dependencies exist.

With this A2 approval and the separate actual-Claude reconciliation, root may freeze the corrected D0 seam and assign implementation. No architecture decision remains hidden behind future acceptance. Existing migration, shared-ledger, recovery, source-union and finite delivery contracts remain part of that implementation scope; summary-only staging still does not finish the user objective.

## Fresh evidence and limits

Run `node docs/implementation/2026-11-16/baseline/policy-architecture/r2/authority-delta/probes.mjs` from repository root:

- **21 independent focused checks passed**, reusing the previous origin witness and exercising the corrected proof/sentinel boundaries.
- **Six expected frozen reproductions and 45 corrected checks replayed** from exact author objects in a bounded owned temporary tree. These are author replays, not additional independent cases or real transaction evidence.
- Exact corrected declarations compiled with existing **TypeScript 7.0.2**, strict/noEmit/ES2022/DOM/bundler options, the author's three negative type cases and our five independent negative cases. The independent cases reject omitted metadata, omitted proof state, proof without selection, falsely successful exhausted reset and falsely committed failed reset. Type checking establishes interface requirements, not runtime proof provenance.
- A focused unchanged-path diff is empty for app/config/catalogue/numeric/finite paths. No production build/test claim is made for this report-only delta.

The first author-replay harness attempt ran from the deeply nested temporary directory and hit a Windows Git relative-path/filename-length error. It was corrected to run the unchanged author script from the documented repository-root cwd; the fresh replay and compilation above pass. This was a review harness issue, not a candidate defect. Temporary inputs were removed only after verifying the resolved child path stays inside this owned review directory.

`probe-results.json` records exact hashes, named checks, author replay/compile counts and limitations. `contract-types.test.ts` is compile-only; `probes.mjs` copies it beside the exact frozen interfaces for compilation. `execution-receipt.json` records task `task_f61d31f26ef3`, dispatch `ctx_9cc0f3443707`, live Codex provider projection `gpt-6.1-sol` and the observed terminal `GPT-6.1-Sol high` line. Reused-terminal requested/effective launch model and effort remain null; the display/receipt is not a verified backend-serving identity. No settings/provider changes, helpers, browser service or dependency install occurred.

**Required future implementation acceptance:** real C proof completion/failure/provenance and ledger exhaustion; actual immutable source/hash/selection bindings; atomic MAX-1→MAX saves/deletes/reset and failed transaction rollback; reset return unions; reload/cross-tab sentinel rejection; writer inventory/fences or actual coherent fallback; local start/generation/config/epoch/database rejection; and the already defined migration/history/export/recovery/finite/next-block/actual-Claude integration matrix. These are source/browser acceptance obligations, not additional reasons to reject this now-implementable contract. No production `derivePolicy`, `admitPractice`, storage transaction, race, UI, performance or learning-benefit result is claimed here.
