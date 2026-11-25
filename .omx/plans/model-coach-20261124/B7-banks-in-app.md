B7 Use the v2 sentence banks in the app

Read `.omx/plans/model-coach-20261124/common.md` and `plan.md` first. You are worker B7. Port 5345. Your worktree starts from the integration branch after A9 (the Firefox and WebKit checks) was merged.

## Why

The app has 40 assessment and 80 practice sentences. Fresh assessment text runs out after a few retests, and both the coach and the practice test depend on it. Pair mode can only drill the pairs the small bank happens to contain. A3 built 600 assessment and 292 practice sentences covering the top 100 pairs. They are described in `ml/corpus/REPORT.md`, and the files are in `typing-app/client/src/generated/`.

## Steps

1. Assessments draw from the v2 assessment bank. Keep the v1 banks in the code, unchanged, so every saved result, retest lineage and fresh-passage exclusion that references a v1 prompt ID still resolves. v2 prompt IDs must be distinct from v1 IDs, for example through a prefix, so that a saved ID identifies its bank.
2. Pair mode drills come from the v2 practice bank, so any of the 100 covered pairs can be drilled with dense text. If the current picker cannot present that many pairs cleanly, propose the simplest option that works, for example a native select. Send me screenshots before building more.
3. Leave General practice (the v1 practice bank) and the current Suggested coach alone. The coach pins the v1 bank through `CORPUS_VERSION` and `BANK_HASH` (`coach-plan.ts:105`). It must keep working until C1 replaces it.
4. Layout. v2 sentences reach 68 characters, against at most 53 in v1. Check practice and assessment at 1440, 390 and 320 px for overflow, clipping and awkward wrapping. Save screenshots in the gitignored `artifacts/` folder; I review them before integration.
5. Corpus tests. `ml/corpus/test_banks.py` stops the whole test runner with `SystemExit` when the cached source export is missing. Make the source-dependent tests skip in that case. Check the committed banks' invariants without the cache: counts, lengths, unique IDs disjoint from v1, and pair coverage.
6. Checks. Run `npm run check`, plus the browser `real`, `typing-flow` and P3 checks in Chromium on port 5345, using A9's port and engine variables. Update prompt-dependent browser expectations only where v2 text requires it.

## Owned paths

`typing-app/client/src/**` for the steps above, `typing-app/client/tests/**` and `ml/corpus/test_banks.py`.

## Done when

All checks pass and the screenshots are ready for review. A report in `artifacts/`, at most about 80 lines, lists what changed for users and for saved data. `worker_done` follows `common.md`.
