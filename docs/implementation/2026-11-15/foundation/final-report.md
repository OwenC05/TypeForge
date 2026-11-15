# Foundation wave completion receipt

15 November 2026. Completed E1 harness and ML-04 numerical repairs in isolated branch `OwenC05/typeforge-foundation`. Parent Task `task_ab1851d93138`, Dispatch `ctx_446d65c5fee5`, Run `run_af59e2a95b3a`. Application source baseline `de69444a6201da96281ca9ad88088904477775a2`; foundation integration input `a991cfad31b410928e4894fa875e8161438354c5` includes plan `45d2da7` and execution-handoff authorization. Root owns daily-practice integration; this lane never modified that branch, root plan/receipt/state or other workspaces.

## Result and independent review

`typing-app/client/tests/app.test.ts` normalizes LF/CRLF source extraction, validates present/ordered boundaries and explicitly rejects a normalized-empty handler before parsing/evaluation. All existing restart behavioral assertions remain. Nine new extraction tests include LF/CRLF execution, invalid markers and whitespace/semicolon-only negative fixtures.

`typing-app/client/src/profile.ts` rejects roundoff-only baseline-minus-user differences before occurrence weighting. The binary64 two-mean gamma(3308) envelope is justified over positive finite engine intervals through 5000 ms and ten 300-character retained sentences in `ml04/numerics.md`. It is numerical error control, not a meaningful-effect/uncertainty policy. The actual ten-sentence 200-ms engine case changes from false he focus score 1.1937117960769683e-12 to null. Four added profile tests cover the engine/orders, 2,880 seeded uniform/order cases, supported count/log bounds and boundary/reachable larger contrasts. Baseline packaging/version and model artifact remain unchanged.

Lead independently reviewed both implementation diffs before integrating. ML child independently reviewed E1 (`ml04/e1-review.md`) and correctly found one MEDIUM normalized-empty-body blocker; E1 child fixed it in c6bdff5 and the lead accepted its explicit guard/failing-then-passing regressions. That finding is resolved, not waived. E1 child independently reviewed the lead browser scripts/evidence (`e1/browser-review.md`): PASS for the bounded claims, no blocker. Its nonblocking README-pointer finding is fixed by `browser/README.md`; stronger provenance/coverage follow-ups remain explicit. No design judgments were made, so no Claude design work was needed in this technical lane.

## Final verification

All checks are local; Node v24.21.0, existing locked npm dependencies. No framework/dependency/API/global-tooling changes.

| Check | Fresh result and evidence |
| --- | --- |
| Original pre-fix full check | Expected failure 94/97, three extraction parse errors before assertions; `e1/baseline-check.txt` |
| ML pre-fix engine/regressions | False he focus preserved; three new numerical regressions failed; `ml04/before-engine.txt`, `before-regressions.txt` |
| E1 review-fix pre-fix | Four normalized-empty fixtures fail with Missing expected exception, then all four pass after guard; `e1/review-fix/pre-fix-regressions.txt`, `post-fix-regressions.txt` |
| Final LF full check, separate typecheck/build | All exit 0; 110/110 tests, no skips/failures; `combined/review-fix/LF-*.txt` |
| Final CRLF full check, separate typecheck/build | All exit 0; 110/110 tests, no skips/failures; `combined/review-fix/CRLF-*.txt` |
| Original restart assertion execution | 3/3 tests; 73 unchanged behavioral assertion calls plus 12 helper guard calls per encoding |
| Instrumented final full suite | Exit 0, 110/110 tests; 90,708 method calls: 90,700 return successfully and eight expected inner guard exceptions are caught by the negative tests |
| Exact source restoration | app.ts restored SHA256 9a06967c04e9dcb00288f71ae5e4baac31a1e3fe080ca95a665f619571ef0f3e; restoredExactBytes=true |
| Committed browser flow | Documented isolated MCP filename runner; Chromium 157.0.8103.52, 39 PASS, failed=0, errors=[]; `browser/typing-flow-result.json` |
| Added restart/lineage browser matrix | Same runner/isolated contexts, 64 PASS over nine scenarios, failed=0, errors=[]; `browser/restart-lineage-result.json` |
| Final production JS identity | app-MoCpUVl4.js SHA256 03c95410e12fd4a52a335270a1fa34f5677b501dd97af653ecaa13657ba73bf0, unchanged by final test-only fix; no unnecessary browser rerun |
| Scope and whitespace | Protected app/engine/model/storage/package/.omx diff against a991cfa is empty; final staged diff --check required before receipt commit |

Final replay from foundation root: `node docs/implementation/2026-11-15/foundation/combined/review-fix/verify-encodings.mjs 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js'`. Then from client: `node --import ../../docs/implementation/2026-11-15/foundation/ml04/assertion-counter.mjs --experimental-strip-types --test tests/*.test.ts`. The ordinary npm test path is unchanged. Count instrumentation proves reached assertions, not full branch coverage. The preloader's raw failed counter includes assertions deliberately thrown inside assert.throws; earlier zero-failed-call wording was corrected in lead-review.md, without changing historical raw logs.

Browser matrix: assessment-from unchanged/restored never gains lineage; practice-from unchanged/restored retains exact lineage and deleted origin drops it; retest unchanged/restored retains lineage and deleted/incompatible origin drops it. Each uses actual native restart/key input and saved-row checks; retained synthetic origins remain immutable. The synthetic legacy-cat origin does not establish real-bank passage exclusion. Practice remaining incompatible, unreadable/corrupt origins and rapid browser races are not newly certified.

## Commit sequence and files

Only three application/test paths changed: `typing-app/client/tests/app.test.ts`, `typing-app/client/src/profile.ts`, `typing-app/client/tests/profile.test.ts`. All other files are under `docs/implementation/2026-11-15/foundation/`; exact paths are in `changed-files.txt`. Meaningful commits in order (root can cherry-pick this lane's entire sequence after its own review):

| Integrated hash | Change / original child hash where applicable |
| --- | --- |
| 01fa86d8172a0e65f1df89e50064570285e6c48e | Task breakdown before any source edit |
| 2197ffa7328ccd00d29121a4b24354a75d2ad10b | E1 repair/evidence; child 19b4195bded66d1706fa61110e9d61cfbb0ec182 |
| 04ba110cad4a8d16a1679c044a0b20d89932cd4b | E1 evidence cleanup; child 50ca3b67cdbe3ed0a59ec708523713e38fa26a0c |
| fc1ebcf0d0eb69c26ae4fcfcbd7610eb909748e2 | Delegation specs and browser harnesses |
| 5f4d9882c599ead95508b69a97a1767ba6893d33 | ML04; child 12b28ec0d8ea27d111c944470f67e1a9c57e85ef |
| 91600f8ca6fe260f352ea0ba437a8dfab4647ff7 | Initial combined evidence/lead review |
| 3b0c3fa4630d0fa9e7b60740f9822830f258c791 | Independent browser review; child 0dfecbd2b05ed724f746cd0d4a5f73ab399e421d |
| bb92f8c7adeac8a3d81bd36a7a35aca73f7c99f2 | Browser replay/coverage documentation |
| 7c3a8b239e168ce25dbf1efd6f5721b3a23fce21 | Independent E1 blocker review; child aebd75773bff482affbdb0068b358dbea8e72547 |
| e55df974f24347f91705e406c9aa1879005690aa | Track blocker honestly pending correction |
| 7ee3873ab572bf9d996bb7fa2e78280579df349e | Normalized-empty repair; child c6bdff5576b2509bcb7ae7254832ce85789e3cbb |
| Final receipt commit reported to coordinator | This report, refreshed lead review, exact changed-file manifest and final 110-test evidence |

## Child Task/Dispatch and model receipts

| Slice | Task / Dispatch | Requested versus observed |
| --- | --- | --- |
| E1 initial | task_c414281b2e3a / ctx_42d3bb53acd2 | gpt-6.1-sol/medium; dispatch and matching client argv observed |
| ML04 implementation | task_59c60447a216 / ctx_dc19a5a48d8f | gpt-6.1-sol/high; dispatch and matching client argv observed |
| Browser technical review | task_ffcde287c5f4 / ctx_49c3991be150 | retained gpt-6.1-sol/medium; matching client argv observed |
| E1 independent review | task_535c838fd121 / ctx_d1df74dcb851 | retained gpt-6.1-sol/high; matching client argv observed |
| E1 blocker repair | task_f58772f6866f / ctx_6f990e6a0214 | requested retained gpt-6.1-sol/medium; resumed argv has no explicit model/effort flags, so current applied client settings unverified |

No receipt proves backend serving identity or applied inference effort; no inference from numeric telemetry. Current local models cache advertised the selected identifiers/levels. All five child Tasks settled succeeded (review success reported its blocker honestly). Two follow-up deliveries were initially turn_start_unobserved; root sent supported attempt-specific continuation, and each later reported under the same exact Task/Dispatch. No duplicated task, poll loop, terminal steering, stop/abandon or invented completion occurred. Early check attempts using unsupported --from and prohibited --run failed without effects; plain worker check was then used.

## Cleanup and remaining limits

Successful preview owned PID 22732 at strict unused port 5197 was identity-checked and stopped; cleanup records zero listeners. Initial preview launch from repository-root cwd failed because that root had no dist; retained failed-launch evidence is distinct from successful client-cwd launch. All scenario contexts closed in finally; browser fault injection restored. Only settled child-owned terminals were released through Orca: ctx_49c3991be150, ctx_d1df74dcb851 and ctx_6f990e6a0214 returned released/closed_agent_terminal, with transcripts captured. Worktrees and ignored child/local node_modules/dist remain; no private profiles/dependencies/build trees/runtime state are committed. No active owned helper remains.

No rendering optimization/E3 traces, Undo repair, schema/metrics change, baseline repackaging, scientific policy, Stage2 implementation, model training/promotion, upload, push or deployment. Existing review limits remain: accelerated-clock Chromium only, no AT/OS IME/physical-device/zoom/other-engine certification, no human yield/learning benefit, no automatic browser CI gate/configured lint. Python historical 19 pass/two missing-sklearn errors were not resolved or rerun. npm ci reported two existing high-severity audit findings; no audit fix/dependency change was attempted. Browser invocation/served-byte provenance remains bounded local evidence, not authenticated deployment attestation. Root integration and later roadmap work remain root's responsibility; no required foundation regression remains unexplained.
