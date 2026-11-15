# ML.1-ML.3 completion receipt

15 November 2026. Task `task_59c60447a216`, Dispatch `ctx_dc19a5a48d8f`, parent `task_ab1851d93138` / `ctx_446d65c5fee5`, Run `run_af59e2a95b3a`. Worker `term_ae3b7f39-db0b-4eea-bf9d-0984a11f17a2`; coordinator `term_90062000-9957-4002-8f66-49467c40954b`. Starting HEAD `01fa86d8172a0e65f1df89e50064570285e6c48e`.

## Result and scope

Completed bounded numerical repair. `profile.ts` rejects a positive baseline-minus-user log difference within the binary64 accumulation envelope **before** occurrence weighting. Above the envelope, the existing evidence/support, score, alphabetical tie and baseline-version paths remain. `profile.test.ts` adds four regression tests. All other additions are bounded scripts, raw outputs and documentation in this directory. No application UI/design, engine, model, corpus, storage, metrics, schema, API, dependencies/lockfile, global tooling or scientific policy was changed. No baseline repackaging or version change.

Mandatory handoff read first; approved Stage 1A, V0/V6, final receipt and ML review/probe inspected. On-disk planning files use CRLF, so their raw SHA256 differs from the approved LF bytes; LF-normalized SHA256 exactly matches approved PRD `b1f8647e5c2096876837702f867e6028e4fa767ef4dc6d32c45634881094f589` and test specification `f25cc8615cbe4c38bb78a29d08e87fcf11a7d9a053de39435bae2c19ba0ef35f`. No approved files were rewritten. Ancestor receipt's planning-only limit is historical; the separate execution handoff authorizes this bounded task.

## Preserved regression and numerical reasoning

Before touching profile.ts, `engine-probe.mjs` reproduced ten eligible submitted engine sentences, 284 pair observations, exactly 200 ms between synthetic keypresses, and false focus `he` with 17 observations and score `1.1937117960769683e-12` (`before-engine.txt`). The same script after repair returns null (`after-engine.txt`). The pre-repair tests retained in `before-regressions.txt` ran 18 tests: 15 passed, 3 newly added tests failed (actual engine, seeded uniform orders, numerical boundary); maximum-count regression already passed. An initial probe import path was one directory too high, produced ERR_MODULE_NOT_FOUND, and was corrected before collecting reproduction evidence; no code was loaded from another checkout.

See `numerics.md` for derivation: positive supported binary64 intervals through 5000 ms bound computed log magnitudes by 744.4400719213812; ten 300-character sentences bound counts by 2990. Engine pair sums, cross-sentence pair sums, total sums, division, smoothing and subtraction fit conservative N=3308. With u=EPSILON/2, tolerance is `2*gamma(N)*max(L, abs(baseline), abs(user))`, about `5.468087666919605e-10` log-ms at supported observation scales. Counts stay exact. Both means' absolute forward-error terms are included; occurrence counts cannot amplify a sub-envelope residual. This is arithmetic correctness on computed logs, not a scientific/practical effect or uncertainty policy, clock certification, or transcendental accuracy guarantee.

Tests cover 2,880 uniform seeded/order cases (3 seeds × 64 samples × 5 intervals × 3 orders), accumulated versus multiplied summaries, reversed pair-entry order, maximum counts at three intervals and k=1/5/20, inclusive boundary 0, T/2, T, 2T with 1/100 occurrences, the actual-engine fixture and permutations, missing/user artifacts, rejected malformed artifact, and a 1e-8 contrast that remains reachable with each supported smoothing k. Existing exact-score/tie and support tests remain unchanged.

## Executed checks

`node docs/implementation/2026-11-15/foundation/ml04/verify.mjs` exited 0 **with the explicitly permitted E1 gap**, not a green full suite. Its acceptance checks require the exact three original extraction failures, their error type, 101 tests and 98 passes; any other nonzero check is failure. Command/exit/hash evidence is in `verification.json` and adjacent stdout/stderr logs (trailing whitespace normalized). Staging exposed trailing whitespace in captured runner output; it was normalized before final commit verification, with no source/test behavior change.

| Check | Result |
| --- | --- |
| Profile/model tests | 25/25 passed; 10,546 executed assertion calls passed (6,219 model + 4,327 profile); no skipped tests |
| `npm run typecheck` | Exit 0 |
| `npm run build` (includes typecheck) | Exit 0; production bundle recorded |
| `npm test` | Exit 1, 98/101 passed, exactly original three E1 failures |
| Instrumented full suite | Exit 1, same 98/101; 90,580 executed assertion calls passed; three source-extraction exceptions occur before their affected assertions |
| Actual engine probe after repair | Exit 0; ten eligible sentences, 284 observations, null focus |
| `git diff --check` | Exit 0 |

The optional assertion preloader counts calls to existing node:assert/strict methods and waits for asynchronous assertion resolution. Counts describe the actual recorded run; tests with random fixtures can execute different totals on another run. It does not turn exceptions before assertions into passes. Default npm test is unmodified. No lint script is configured; no new linter or dependency was added.

Known E1 failures, all `ERR_INVALID_TYPESCRIPT_SYNTAX` / `Expected ',', got ';'` in unchanged app.test.ts source-extraction paths:

1. Restart waits for fresh calibration and focus before enabling replacement input.
2. restarted retest re-resolves exact origin; deleted, incompatible or unreadable origin becomes ordinary assessment.
3. assessment from URLs never acquire retest lineage on restart; explicit practice/retest origins retain their contracts.

## Identity, gaps and cleanup

Requested `gpt-6.1-sol` / `high`; observed live ancestor `codex.exe` PID 1520 configured `-m gpt-6.1-sol -c model_reasoning_effort=high`. This proves client process configuration only. Actual backend identity and applied effort are unverified; no inference from numeric telemetry.

Verified raw source SHA256: profile.ts `3eb148c75f85482675ab00f4577b3a7a450f4ba8268734d5f74c8646bd5d4b9b`; profile.test.ts `a2be4ec1a2d152a050a91919062e88c8562789ce4ed7a638b7bcb88ce6b1f9b9`. Artifact raw SHA256 remains `d7d960f4c553a84bae92ff36dd4890a1e321ac9967f777708e44c13ea0f64862`; starting/current artifact Git blob both `1f8996759cc665ba09bbc8145907dd66ea9b7cfd`. Built JS `app-MoCpUVl4.js` SHA256 `03c95410e12fd4a52a335270a1fa34f5677b501dd97af653ecaa13657ba73bf0`; other asset hashes are in verification.json. Build outputs are evidence of this child build, not a deployed Git revision.

No helper worker, server, browser, background helper, paid job, upload, push or deployment was started. Only child-local npm ci (19 locked packages), foreground test/build commands and inspection were used; node_modules/dist remain ignored child-local artifacts available for parent review. No processes/ports in original/root workspaces were touched. No owned background process needs closing. Parent owns integration, independent technical review, combined E1 validation and browser checks.

Existing Python limitations (historical 19 passes, two missing-sklearn errors), accelerated browser/hardware/IME/AT/device limits, real-user incidence, scientific benefit, retraining/promotion and deployment provenance remain unchanged and were not rerun or claimed here. The numerical bound supports genuine engine-derived observations; permissively accepted fabricated extreme stored sums and future changes to prompt/history limits require separate review. Stop after owned commit and completion message; any later cross-review is a separate task.
