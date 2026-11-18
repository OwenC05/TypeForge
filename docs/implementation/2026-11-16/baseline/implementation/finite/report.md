# Finite engine implementation

Lane E owns only engine, finite adapter/validator and their tests. Root integrates; C owns saving/retry and F/actual Claude owns all UI decisions.

Plan: first lock default timed behavior and add failing finite endpoint regressions; then add the opt-in atomic finite terminal, adapt the admitted immutable certified plan, and validate the separate source envelope. Verify all four shipped plans, deadline endpoints, editing/flags/stops, terminal immutability and corrupt sources through production modules, then run the unchanged full app checks. No persistence or UI acceptance is claimed by this lane.

Dependency: D's acyclic synchronous `CONFIG_ID` and `validateCertifiedPlan` exports in `coach-plan.ts`; C resolves stored plan identity before invoking E's synchronous validator. No storage import or source-supplied config authority is used.

## Delivery and exact exports

Implementation commits: **fb2781b53e0d5b77c7df1a5d2106a48ecdeca50f**, then **f88e3134d690c6bbb05fb81bd6e045265d4f7860**. Root should cherry-pick these E commits, not duplicate the dependency commits already integrated in root.

- `src/finite-practice.ts`: `createFiniteAdapter(input: { id: string; snapshot: Readonly<PracticeSnapshot> }): FiniteAdapter`.
- `src/finite-practice-result.ts`: `validateFinitePracticeResult(value: unknown, suppliedPlan: CertifiedPlan): FinitePracticeResult`, throwing `FinitePracticeValidationError` for invalid source fields; D may throw its certified-plan error for an invalid supplied plan.
- `TypingEngine` has opt-in `finite: true`, distinct `plan-exhausted`, defensive `finiteResult()` data, nullable finite `nextPrompt`, and refuses finite `restart()` in favor of a new adapter/ID/admitted snapshot. Default timed callers retain nonnull next-prompt typing and wrapping behavior.

D input `db4af5eb41953c1589a2cd18c856eb147bd18fdf` is imported here as `24037af`; root shared-type amendment `ad964ed` is imported as `8acf63f`. Neither dependency is E-authored. Frozen adapter/validator signatures are unchanged. Supported config is D's verified shipped `de43c1c2266364e8c859ac3abc61126590fbec2d10be9b7e0e14616770411995`; supplied sources cannot nominate an arbitrary config authority.

## Behavior and validation

The engine advances its monotonic clock before admitting each action. Final submission before expiry commits and enters `plan-exhausted` atomically; at/after expiry it leaves an ordinary timed result with the unfinished last sentence. Finite current-prompt lookup holds the final context without modulo wrap; finite next context is null on the last prompt and after exhaustion. Later edits/ticks/interrupt/abort do not alter terminal text, elapsed time, flags or metrics. Stopped and aborted outcomes remain distinct and return no saved result.

The adapter copies only the exact validated immutable plan, uses flow-v1/metric1/en/corpus1/QWERTY/30000, and has no selector, duration clamp, appended prompt or old-selector/manual/retest provenance. C/D admission remains the caller's prerequisite; synthetic already-admitted test fixtures exercise this engine seam, not a counterfeit storage/admission proof.

Early results use only the new envelope with practice, plan-exhausted and false progress eligibility. The separate validator checks exact object/array structure and keys, existing UUID domain, canonical UTC calendar round trip, supported settings/config/certified plan identity and prompt order/count, positive finite actual elapsed below30000, finite actual-time formulas, bounded safe counts, response/deletion/retained/key aggregates, flags/diagnostics/null accuracy consistency, eligible pair bounds, existing optional prediction shape/binding, ordered chart observations and final metric equality, and total serialized bytes <=1 MiB. Fast finite WPM can exceed the timed30s ceiling. The timed validator is unchanged and rejects these real early envelopes.

The calibration boundary check uses a real `FinitePracticeResult` in the frozen `SavedSource` union, rejects it through the timed validator, and verifies that a timed-history consumer cannot accept it at compile time; it does not manufacture a timed result with edited flags. D was explicitly notified that full baseline/summary/coach eligibility tests must also use this real envelope. Their actual policy/consumer integration remains outside E's lease.

## Fresh evidence

- Before engine changes: the18 existing engine tests passed and both new finite regressions failed (wrap/absent terminal), as captured in the session's command output.
- Final `npm run check`: **168/168 tests**, TypeScript7.0.2 typecheck and Vite8.3.3 build pass; full output is `check.txt`. The initial164-test checkpoint is retained separately in `check-initial.txt`.
- Tests cover actual production adapter/engine behavior for **he501, in491, le502, th480** prompt characters, all12 submitted prompts, synthetic overrun, final context/null next, deadline minus0.001/exact/plus0.001, all four plans' edits/backspace/incorrect/repeat/interruption/invalid/missing/malformed timing, response/attempt stops, abort, zero/nonfinite inputs and corrupt metric/chart/plan/extra fields. Source/terminal defensive copies and immutable actual elapsed are checked.
- The fast-input test admits WPM above the old timed ceiling. Predictions are tested through actual finite-engine frozen prediction output and the strict separate validator, with corrupted identities/counts/nonfinite/underflow values rejected.
- Existing committed native typing-flow browser suite (only base URL changed to E5322) passes **46/46 assertions, zero failures, zero page errors**, Chrome157.0.8103.79; `browser-summary.json` records the returned summary and `typing-flow-5322.js` is the exact executed script. This verifies ordinary timed native input/edit/rollover/deadline/save/retry/export behavior, not new finite persistence or UI.
- `git diff --check` passes. No lint script exists; none was added. `npm ci` used the unchanged lockfile and reported zero audit vulnerabilities.

Browser tests used fresh isolated contexts/databases only. Hidden owned preview: node PID65352, `node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5322 --strictPort`. Exact executable/command receipt is `preview-helper.json`; verified process identity and cleanup are recorded in `preview-cleanup.json`. The process was stopped and5322 has no listener; test contexts closed in the script's finally blocks. No helper agents were started.

Final Git blobs:

| E file | Blob |
| --- | --- |
| src/engine.ts | 49191b896c27a5381ca2cbfa6c366221cd5820fe |
| src/finite-practice.ts | 727e469d0f24edc8d52e1029aae461988e20dbc0 |
| src/finite-practice-result.ts | ac03b966e1e725611334050af0ffc19bde4940c4 |
| tests/engine.test.ts | 0b08123fd99824e2e951f0e971c55102f6f18c8c |
| tests/finite-practice.test.ts | 91ef3fff2da8c38f2ea8c382a31b0ab58d2d3402 |

## Remaining integrated acceptance

C/F must demonstrate real finite source save/history/retry/export with the original ID/hash/capture through rapid Again and failed saves. D/root must verify exclusion of clean durable finite sources from baseline, summary and coach, while ordinary eligible timed practice informs the next block. Actual Claude owns finite marker, early label, flagged explanation/figure precedence, focus and all other UI choices. Root owns active-snapshot admission under authority/config changes and independent combined acceptance. No finite persistence, finite browser UI, AT/device/OS-IME/human comprehension or learning/dose benefit is claimed here; the old geometry/unsaved/agent browser matrices were not rerun by E. No production UI, app/storage/corpus/policy/package or real user data was edited. Runtime provider/model/effort were not independently exposed by a receipt in this lane, so none are inferred from the requested high-effort assignment.
