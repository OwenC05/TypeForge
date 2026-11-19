# Initial-position key-accounting correction

Root requested a narrow correction after independent review560dc6bec407d52d6cc5a908292849b8b06772ed (root425c74e) found a coherent impossible non-clean source. The independent report/probe and exact emptyKeyEnvelope/validReverse observations were read without changing reviewer evidence.

Plan: add red regressions for empty and missing-initial-key maps with coherently reduced root correctAttempts and root/final-chart accuracy, retain the real reverse-at-position0 positive case, add only the unavoidable initial-key presence invariant before clean-only frequency checks, and run targeted/typecheck/full verification. E writes only its validator, tests and evidence; no engine/adapter/UI/storage/shared dependency authoring, helpers or browser work.

Approved dependency imports: root0e318ab =>0456a01; D337bd4f =>f7d817d; Df77be72 =>702bbba; D5d1951f =>104d94d. Accepted dependency blobs verified: coach-plan8c3c411f56b9732fe2a47ff1bcbf509e71f85107 and coach-types43f7c070788631e8014ee905dc634d55171cb38a.

Correction commit: **8378937f39c3bbdfcf476c80b558af4ffd38b44f**; exact validator blob **a1ea3f4c3d359ad3973ec8f6ba1b03111e88b9c7**. Root received this tested commit for C in message `msg_699bfd92c607`. Runtime interfaces and engine/adapter are unchanged. The sole production change is `check(Object.hasOwn(keys, prompt.text[0]), ...initial key...)` before the eligible-only frequency branch; existing per-key positive attempt/first-attempt checks still apply. No full-key or clean-frequency gate was added for edited sources.

Red/green evidence:

- `initial-key-red.txt`: focused test run exits1 with **2 failures and1 pass**: coherent empty/missing-first-key sources are accepted unexpectedly, while the real reverse-insertion source already passes.
- `initial-key-targeted.txt`: changed validator passes **44/44** finite/engine tests, including all four plans' original edit/invalid/repeat/missing-timing traces, both coherent corruptions, and real reverse insertion yielding the correct full response with only `p` recorded and `incorrect/edited` flags.
- `initial-key-check.txt`: `npm run check` passes **197/197 tests**, TypeScript7.0.2 typecheck and Vite8.3.3 build. No lint script is configured. `git diff --check` passes.
- `initial-key-replay.mjs` reads the exact independent Git payload and writes only E evidence; `initial-key-review-replay.json` records rejection of the original complete emptyKeyEnvelope (501 retained/501 attempted/463 correct/512ms) by the corrected production validator. It does not rerun or modify the reviewer's acceptance-reproduction harness.

No new browser/server, helper agent, dependency, global configuration or real-user-data operation was performed. Only E's validator/tests/evidence are authored; the named other-lane changes above are root-authorized dependency imports. Root/reviewer still owns independent reacceptance and C/F owns storage/UI integration; these author checks do not claim either.

Actual current-dispatch receipt is `initial-key-worker-receipt.json`: task `task_2ae8605de2de`, dispatch `ctx_c58421b51032`, run `run_1aeb00550f39`, terminal `term_880f4588bb75cb4c253fef6f9f79c428`, live/fresh observation, provider `codex`, model `gpt-6.1-sol`. No effective-effort field is present; requested high effort is not reported as independently verified backend effort. No provider/model configuration was changed.
