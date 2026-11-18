# C storage implementation

Worker task task_7cae09d835e7, dispatch ctx_34bb6b024b5b. Integration owner is root; this lane owns storage modules and synthetic storage fixtures, with no UI edits or real user database migration.

## Work and acceptance sequence

1. Atomic v3 upgrade and current-source capture/save/retry/delete/reset, with durable MAX sentinel and original legacy store retained.
2. Native merged source/history retrieval, bounded JSON-prefix acquisition and separately typed finite validation.
3. One preparation ledger covering source/collision/membership/metadata attempts, including failed/missing requests and reserved proof/admission reads; terminal record-limit across both streams and companions.
4. Actual overlapping final transaction, immutable compact binding and post-proof D projection; current local identity and same-ledger authority check immediately before admission.
5. Real browser fixture execution against a new isolated loopback origin/database, then full Node/typecheck/build and explicit app/UX handoff limits.

## Dependencies and integration obligations

- Root froze coach-types.ts at14b2a43 and amended ProjectionInput.work atad964ed; C supplies actual ledger counters.
- D plan/config/certificate dependency db4af5eb41953c1589a2cd18c856eb147bd18fdf imported asbb11184. Finite-source resolver grants exact shipped content identity only.
- E engine/finite source dependency fb2781b53e0d5b77c7df1a5d2106a48ecdeca50f imported as39fb667. Distinct finite validation is never applied through the timed validator.
- D policy runtime is still pending at this checkpoint. No stub is used or counted as acceptance.
- Root confirmed additive C exports createPreparationLedger/invalidatePreparations/subscribeStorageInvalidation/admitPreparedPractice. F must replace the existing unsaved existence shortcut with full source/hash/membership reconciliation and retain original capture; root audits the complete integrated writer fence.

## Checkpoint evidence

`node --experimental-strip-types --test typing-app/client/tests/storage.test.ts typing-app/client/tests/history.test.ts typing-app/client/tests/coach-storage.test.ts`:26/26 pass. These are Node validator/ledger/prefix/failure cleanup checks, not real IndexedDB execution. Final preparation and browser acceptance remain open.
