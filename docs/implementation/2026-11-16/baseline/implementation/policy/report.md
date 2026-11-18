# D implementation: pure policy and certified finite plans

18 November 2026. Author implementation, awaiting root integration and independent acceptance. No browser/helper/service was started. No real-user data, model fitting, UI/design, corpus, package or storage writes are part of this lane.

## Commits and dependencies

- `db4af5eb41953c1589a2cd18c856eb147bd18fdf`: exact config/catalogue promotion, fixed certified plan resolution, historical finite identity resolution and five tests. Sent to root and E immediately after targeted tests/typecheck.
- `337bd4f8b2fef4ab1119df0a7dde9b8da5a00ba4`: production policy, metadata/membership validation, proof/source/range bindings, immutable candidate admission and initial policy regressions. Sent to root after 28 targeted and 191 full tests/typecheck/build passed.
- Follow-up commit containing this report: tightens pending-state validation and unissued-candidate rejection; adds explicit weak-participation/cohort regressions. Final commands/results are below.
- Root-owned contract corrections imported unchanged: `ad964ed` (measured `ProjectionInput.work`) and `0e318ab` (nullable ordinal when pending tests reach cap). D reported both concrete missing seams and did not modify shared declarations independently.
- E-owned dependencies imported unchanged: `fb2781b53e0d5b77c7df1a5d2106a48ecdeca50f` and `f88e3134d690c6bbb05fb81bd6e045265d4f7860`. D's finite-exclusion regression uses their real adapter and validator, with the explicit `SavedSource` union and no SessionResult cast. Root should integrate the original E commits, not D's local cherry-pick equivalents.

## Exact identities and consumer exports

| Identity | Canonical SHA-256 |
| --- | --- |
| Enabled schema-v3 / clean-pair-contrast-v1-r2-enabled config | `de43c1c2266364e8c859ac3abc61126590fbec2d10be9b7e0e14616770411995` |
| Unchanged four-plan catalogue | `17de69ffe905a28e8e00ad65d1494a003b080bcd2a894a81fea5c28351594a25` |
| Complete immutable assessment+practice corpus, corpusVersion1 | `b73528f56537020c915dcf5e3a6a4e970e438ebc3210758f093901d92ef736b1` |

`coach-policy.ts` exports the frozen `validateMetadata(value): Metadata`, `validateMembership(value, source, capture): Membership`, `derivePolicy(input): PreparedProjection`, and `admitPractice(input): Admission`. `validUTC` is an additional pure timestamp helper. D propagates `input.work` unchanged; C supplies the actual same-ledger snapshot after proof accounting.

`coach-plan.ts` exports `CONFIG_ID`, `CATALOGUE_ID`, `BANK_HASH`, immutable `COACH_CONFIG`, `validateCoachConfig(value)`, synchronous `resolveCertifiedPlan(pair): CertifiedPlan | null`, synchronous `validateCertifiedPlan(value): CertifiedPlan`, and root-authorized `resolveStoredFinitePlan(identity: FinitePracticeResult['plan']): Promise<CertifiedPlan | null>`. Historical resolution checks all five exact persisted identity fields without inventing an active evidence/baseline gate. Unknown identity returns null. The module has no storage/policy/finite-runtime imports. Shared pure utilities are `canonicalJson`, `hashCanonical`, `deepFreeze`, and `pairOccurrences`.

No asynchronous digest can satisfy the frozen synchronous derive/admission signatures. A small synchronous SHA-256 implementation hashes canonical UTF-8 JSON; the tests compare it to independent Node crypto on complete config/bank and padding/Unicode/scalar cases. No dependency was added. Plan content hash is the reviewed `{pair, bankHash, prompts}` relation; certificate ID binds `{configId, catalogueId, bankHash, pair, prompts}`. Every required integer prefix is checked again during resolution. No runtime search, rotation, repeated ID/text within a plan, cycling or legacy provenance spoof is present.

Final Git blob identities (paths relative to `typing-app/client`):

| File | Blob |
| --- | --- |
| src/coach-policy.ts | `8ca0ea717347ffc28899bb7083e20fcc97da305e` |
| src/coach-plan.ts | `8c3c411f56b9732fe2a47ff1bcbf509e71f85107` |
| src/coach-config.json | `bb30c0092b1619316776c728d285e18ea337f98e` |
| src/coach-catalogue.json | `cf7f0975fde5b702c72d59f786d47f03cfd31ea8` |
| tests/coach-policy.test.ts | `6633f40a27cc74bd638da4756547efb563ce4ba6` |
| tests/coach-plan.test.ts | `be12fca85558f2cfda15068e0c0c81131f198ad3` |

## Source and authority conditions

Every prepared source ID, kind, completion time, complete canonical hash and current membership is checked against its bound ref. Exact duplicate rows count once; conflicting bytes, refs, memberships or physical partition fail integrity. A current row without membership is excluded and cannot become legacy. Legacy requires physical legacy partition, initial legacy epoch and completion at/before the metadata cutoff. Complete range authorities must match metadata/input/proof, and ordered summary/coach ranges must contain the full known newest prefix. C remains responsible for proving unseen-source coverage in real storage.

The cohort is unchanged: timed schema/metric1, flow-v1, exactly30s, en, explicit QWERTY, corpus1, compatible default context/active captured epoch, ordinary purpose, valid saved result, eligible/no run flags, at least one attempt, nonfuture completion. Assessment alone enters capped participation and newest-ten summary. Eligible timed practice enters the subsequent newest20/30-day inclusive coach window. Early finite envelopes enter none of those evidence windows. Pending/failed retryable original-capture potential assessments affect only pendingSave/next ordinal; duplicates, known durable IDs, uncaptured/old epoch/protected/practice/finite/rejected sources do not.

C alone creates the actual final storage proof. D validates method, full metadata, now, exact ordered source refs/memberships and every component range, then retains that same proof object throughout. Null proof produces safe pending zero/no median/no focus/no candidate. Metadata MAX remains structurally readable but semantically non-admitting. Matching TypeScript shapes/scalars and object identity never establish a transaction. Admission requires the exact immutable candidate returned by D and the same C proof, current generation/config/authority and idle state. C must pass that actual object directly; a structured clone is intentionally rejected.

Participation, summary selection and recent evidence remain independently proved. Ten bound witnesses can prove capped participation while summary or coach remains pending. Below cap, ordinal is count+eligiblePending+1 only below ten; nine durable plus one pending remains in-progress/count9/ordinal=null. Accuracy is all-ten-or-null with its valid-source count; no nine-source median. The active immutable snapshot cannot be changed by a subsequent deletion, config/corpus failure or new practice result.

Sentence handling retains latest eligible immutable text before semantic exclusion, with greatest ordinal inside a run. Known IDs deduplicate by their bank text even when a newer stored text is wrong. All-pair/key/count/log-domain guards and candidate-specific complete target attribution remain; no rejected pair can survive as another candidate's complement. No metric1 aggregate-to-elapsed rejection exists. Canonical compensated accumulation, all-contributing-run whole halves, exact support/effect thresholds and highest-delta/ASCII-tie selection remain. Runtime config/plan failure abstains independently of Ridge and never invokes the old selector.

## Validation and limits

Run from `typing-app/client` under Node24.21.0 / npm11.19.0, unchanged lockfile installed with `npm ci`:

```
node --experimental-strip-types --test tests/coach-policy.test.ts tests/coach-plan.test.ts
npm run typecheck
npm run check
git diff --check
```

Final targeted suite: **29/29 passed** (24 policy groups and five plan groups). Full final suite: **192/192 passed**, strict TypeScript7.0.2 typecheck and Vite8.3.3 build passed; the complete receipt is `full-check.txt`. No lint script is configured. Tests execute the production functions, not imported author selector relations. They use independent Node SHA/median/prefix calculations, frozen expected C2 support and an explicitly labelled in-memory stand-in for C's actual proof.

Connected actual-engine `he` is28 target /543 reference,10 target runs,19 prompts,4 words; halves10/234 and18/309, five target runs each, certified501 characters. Independent every-prefix scans recertify he/in/le/th at501/491/502/480 characters. Below/at/above249.999999/250/250.000001ms versus200ms yields false/true/true; uniform abstains. The original C2 lagged event trace replays to the identical canonical saved-source hash, and its30000.030000000028 interval-bound witness remains usable with30000 elapsed. Malformed complement/count/log/key/run inputs cannot create focus; latest-text/no-backfill, greatest-ordinal, reference-only halves,7+13 half failure, uniform newer-half failure, exact30-day/newest20, capped-versus-newest proof, null accuracy, reset/deletion, pending ordinal, real finite exclusion and ordinary practice feedback are exercised.

During test development, a reference-only fixture was initially incorrectly expected to remain ready; the reviewed split actually has seven targets in its older half and correctly retires the focus. A summary comparison initially compared entire proof objects despite a changed bound source list; only the unchanged assessment summary value is equal. Both expectations were corrected without changing policy gates. An evidence-log redirect initially used an absent directory and did not run its check; the final receipt is from the corrected absolute workspace location, with the actual command result inspected.

These pure tests are not IndexedDB transactions/races, writer-fence acceptance, measured browser performance, native input/UI/AT acceptance, realized exposure or human learning evidence. C's real completed proof/ledger tests and root's integrated writer inventory, browser/finite lifecycle and actual-Claude/independent acceptance remain required. No empirical threshold/dose/benefit claim is made. No background helper remains running.
