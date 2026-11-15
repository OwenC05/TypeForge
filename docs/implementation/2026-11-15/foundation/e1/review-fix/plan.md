# Normalized-empty restart handler repair

Owner: solo E1 child; Task `task_f58772f6866f`, Dispatch `ctx_6f990e6a0214`, terminal `term_bdea906e507035d1d02081fb8d067fd4`, coordinator `term_90062000-9957-4002-8f66-49467c40954b`.
Source base: `0dfecbd2b05ed724f746cd0d4a5f73ab399e421d`.

1. Preserve independent finding from `aebd757:docs/implementation/2026-11-15/foundation/ml04/e1-review.md`; add four LF/CRLF whitespace-only/semicolon-only helper rejection fixtures and capture their expected pre-fix failures before touching the helper.
2. Keep marker guards and all existing behavioral assertions; normalize the extracted handler fully and assert nonzero length before return. No helper refactor or product behavior change.
3. Store fresh evidence only in this review-fix directory; run focused tests, full check plus separate typecheck/build under LF/CRLF app-source variants, restore original bytes in finally, and tally actual original restart calls separately from the added guard calls. Review scoped diff, record requested/observed client settings, commit owned files and report to lead.

Only app.test.ts and this evidence directory may change. No helpers/dependencies/global tooling/API changes, runtime-state writes, terminal polling/steering, browser/server, UI/design, Undo/metrics/schema, baseline/policy, other workspace/branch, push or deployment. Historical evidence remains untouched. Expected regression failure before repair is evidence; every final validation must pass. Independent local base has 102 tests before these four additions; lead integrates into its separately changed ML04 base. Requested configuration remains gpt-6.1-sol/medium; client receipts do not prove backend/applied effort.
