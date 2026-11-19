# D: implement pure policy, validation and certified plans

Implement the accepted pure-policy lane. Read `implementation-worker-common.md`, `implementation-freeze.md`, the exact spec/config/catalogue, `policy/authority-delta.md`, frozen `src/coach-types.ts`, C2 r2 approval and A2 authority approval. Root owns integration; you are not alone and must preserve other changes. No UI/design work.

**Exclusive lease**, relative to `typing-app/client`: new `src/coach-policy.ts`, `src/coach-plan.ts`, `src/coach-config.json`, `src/coach-catalogue.json`, `tests/coach-policy.test.ts`, `tests/coach-plan.test.ts`. Evidence/report lease: `docs/implementation/2026-11-16/baseline/implementation/policy/`. Root retains `src/coach-types.ts`; C owns persistence/preparation; E owns finite producer/validator. No app/style/corpus/storage/engine/model/package edits.

Break work into: (1) exact config/catalogue identity plus strict metadata/membership semantics; (2) immutable source admission, dedup/window/contrast/halves and deterministic selection; (3) capped assessment participation and rolling newest-ten summary with independent proofs; (4) certified finite plan and admission; (5) independent-witness regressions and consumer export handoff.

Promote the exact enabled config and unchanged four-plan catalogue; preserve canonical hashes and every threshold/context. Implement `validateMetadata`, `validateMembership`, `derivePolicy` and `admitPractice` with the frozen declarations and actual final proof supplied by C. Metadata structurally permits MAX but no optional authority admits it. Check source, membership, range and immutable proof-selection bindings; propagate the same actual proof instead of creating one. Null/failed proof cannot fabricate a current count, median, focus or candidate. Preserve independent component completeness, not-requested/null versus false, pending original-captured assessment counts and ordinal semantics. Do not turn a TypeScript shape into proof of a transaction.

Reuse the reviewed real-engine C2 witnesses and negatives: lagged keydown/input domain, malformed complement/count/log/key inputs, uniform no-target, connected he positive and exact contrast boundaries, latest-text dedup before exclusion, all-contributing-run halves, exact30-day cutoff/newest20, capped10 versus newest-ten ordering, all-ten accuracy/null and reset/deletion. Eligible timed practice changes the next coach window only; early finite results never enter baseline/median/coach/calibration. No empirical learning claim or threshold relaxation.

`coach-plan.ts` must verify exact immutable corpus/catalogue/plan identity and every required prefix; no runtime search, repeated text inside a plan, uncatalogued cycling or fake legacy practiceFocus/manualDrill. Publish the concrete plan-resolution exports needed by C/E early while keeping frozen public signatures unchanged. Use existing corpus read-only. Runtime config/plan failure abstains independently of Ridge; no hidden old-selector fallback.

Verify actual implementations with targeted tests, strict typecheck/build and full existing tests. Do not merely copy the author relations and call them a production selector. Record exact config/catalogue identities and source conditions. Commit source/tests/report, send dependency-ready hashes to root promptly, then worker_done when the lane is complete. No browser service is normally needed;5323 is reserved for this lane if a concrete check requires it.

## Narrow C integration follow-up: shared provisional classification

C question `msg_708a780587d0` requires prefix stopping to use the same eligibility rules as the final projection. Root approves the additive export from your owned `coach-policy.ts`:

```ts
qualifiesPolicySource(
  read: SourceRead,
  input: Pick<ProjectionInput, 'metadata' | 'now'>,
  assessmentsOnly?: boolean,
): boolean
```

Expose and reuse the existing private `qualifying` implementation with that narrower input rather than duplicating its gates. Existing frozen signatures, shared declarations, thresholds and source/proof semantics remain unchanged. Use the same function internally for pending classification, participation, summary and coach eligibility. The result is provisional classification for bounded scanning only: it does not prove persistence, source bindings, range completeness or current authority, and cannot authorize a count, median, candidate or practice session before the actual final proof. Document that C must acquire and validate sources, references, metadata and membership through the existing bounded path; final projection still checks the complete bound selection. Do not introduce a second hashing/read/proof path or move gates to storage.

Add focused behavior coverage for using only metadata/now before proof, assessment-only versus ordinary timed practice, physical legacy/current capture rules and finite exclusion, reusing existing actual-engine fixtures. C separately owns real-IDB prefix over-read/race/budget tests. Preserve the existing file lease and other workers' edits, commit this small source/test delta independently, report the exact helper signature and commit promptly, then update your lane evidence. Root integrates and forwards to C. No UI, new dependency or additional worker is needed for this bounded amendment.
