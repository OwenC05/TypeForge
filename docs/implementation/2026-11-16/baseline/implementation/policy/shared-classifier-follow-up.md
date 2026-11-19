# Shared provisional source classification

Root request `7c3f8fbb03d6be386fa439ee7f4708c16dded9c0`, task `task_514f2a769e31`, dispatch `ctx_ecab0eaa7528`. Source/test dependency commit: **`5d1951ff02ddb6586e0872bc28c5f28165dab0a0`**, sent promptly to root after focused tests and strict typecheck. An earlier outgoing message accidentally contained a clearly labelled placeholder rather than the hash; the immediate correction supplies this exact commit and is the readiness receipt.

```ts
export function qualifiesPolicySource(
  read: SourceRead,
  input: Pick<ProjectionInput, 'metadata' | 'now'>,
  assessmentsOnly?: boolean,
): boolean
```

The existing private `qualifying` predicate is renamed/exported and its input narrowed; its body and gates are unchanged. Pending classification, participation, summary and coach eligibility all use this same function. No duplicate predicate, hashing/read path, proof creation, shared declaration change, UI or dependency is introduced. Exact enabled config, catalogue and thresholds retain the identities in the original lane report.

The boolean is provisional classification for bounded range stopping. C must acquire and validate source content, references, metadata and membership on its existing bounded path. The predicate cannot prove persistence, immutable source binding, range completeness or current authority. Only final projection after C's actual proof may publish a count, median, candidate or practice admission; the complete bound-selection checks remain unchanged.

Focused real-engine fixture checks cover classification with only metadata/now before proof, assessment-only versus ordinary timed practice, physical legacy initial epoch/cutoff, missing current membership and database/context/epoch/purpose exclusions, reset/future completion, and exclusion of an actual finite adapter result. A positive provisional assessment classification with null final proof still yields pending zero/no median/no candidate, and classification does not mutate the inputs.

Commands from `typing-app/client`:

```
node --experimental-strip-types --test tests/coach-policy.test.ts tests/coach-plan.test.ts
npm run typecheck
npm run check
git diff --check
```

**31 targeted tests and 194 full tests passed**, with strict TypeScript7.0.2 typecheck and Vite8.3.3 production build. Full fresh receipt: `shared-classifier-check.txt`; prior `full-check.txt` remains the original 192-test receipt. No lint script is configured. No browser/helper/service was started, no other lane's files were edited, and the working tree is clean after the evidence commit.

C owns the real IndexedDB prefix over-read, races, ledger and final authority acceptance. This extraction does not claim those cases or change the original report's independent technical/actual-Claude/root integration limits.
