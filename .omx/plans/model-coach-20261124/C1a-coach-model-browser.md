C1a The coach model in the browser: engine only, with parity tests

Read `.omx/plans/model-coach-20261124/common.md` and `plan.md` first, especially "The model", D12 and phase C. You are worker C1a. No port. Python runs in WSL as `common.md` describes, with `OPENBLAS_NUM_THREADS=1`. WSL sometimes times out at startup (`Wsl/Service/0x8007274c`). Retry once before treating that as a failure.

Owen's direction: keep TypeForge lean. Build only what this brief needs. No options, abstractions, tooling or documents for their own sake. When in doubt, leave it out and say so in your report.

## Why

B4 chose L5, a pair-by-speed expectation plus a shrunken personal gap. The fresh test (B6) decides whether it replaces the current coach (plan D12). L5 is fitted on training typists only, so the browser can get the model now: a table exported from that fit, and a TypeScript port of the decision math. The port must agree with the Python code that produced the validation results.

This task changes nothing users see. Nothing in the app calls the new module; C1b will wire it in after B6. You also do the eligibility half of C2: check that the browser engine extracts the same intervals as A2's rule, which produced the training data.

## Material

- `ml/coach/model.py`: `update(model, n, total)` and `suggestion(state, model, n, frequency)`, with the constants at the top of the file. `Speed.expected` holds the support clip: beyond either boundary the pair pattern stays at the boundary, and the user's own level continues with unit slope.
- `ml/coach/validation.py`: `fit_training(train_path)`, `coach_inputs()` (the frequency vector, per 1,000 characters and zero outside A3's 100 pairs) and the fitted-model digest described in `ml/coach/PREREG.md` ("Identity and execution").
- Training data, read-only in WSL: `/home/owenc/typeforge-data/aalto-136m/dataset-v2/train.npz`, SHA256 `4ee076d14840e8ef9d5f8c69e2a35b20618567a44316e84df2003a28b4cc7b16`. Never open validation-corrected, fresh or legacy data. You need only train.
- The browser engine records, for each eligible sentence, `pairs: Record<pair, {count, logSum}>`, the natural-log keydown intervals between adjacent a–z letters (`typing-app/client/src/engine.ts`, near line 340).
- A2's 32 eligibility fixtures: `ml/fixtures/eligibility-v2.json` (clean-copy rule; checked by `ml/tests/test_eligibility_v2.py`). `typing-app/client/tests/model.test.ts` shows how a client test reads a fixture under `ml/fixtures/`.

B4 is amending `ml/coach/` on another branch at the same time. Do not edit any existing file in `ml/coach/`; import from it. Your branch must still match the fitted-model digest `c813005bd99f23fc88b9370490eb8dffa1792c57d5151d23b07047477fe85158`. If it no longer matches, stop and ask.

## Work

1. **Browser table.** Add `ml/coach/browser_table.py` (a new file).
   - Verify the train file's SHA256, fit with `fit_training`, and verify the fitted digest before writing anything.
   - Write `typing-app/client/src/generated/coach-model.json` containing:
     - the version, the fitted digest, and the SHA256s of the train file and of `ml/corpus/pair_frequencies.json` (Git LF bytes);
     - `center`, `low` and `high`;
     - 676-element arrays in `aa`…`zz` order (index `26 * first + second`) for `a`, `b`, `sigma2`, `tau2` and `frequency`, the last from `coach_inputs()`;
     - the constants `MIN_COUNT`, `GAP`, `COACH_Z` and `RANGE_Z`.
   - Use full float64 precision. Two runs must produce identical bytes. Add a test in `ml/tests/test_browser_table.py`.
2. **TypeScript port.** Add `typing-app/client/src/coach-model.ts`, pure functions with no DOM and no storage:
   - parse and validate the table: shape, lengths, finite values;
   - fold saved sentences' `pairs` records into per-pair counts and log sums (ignore keys that are not two a–z letters);
   - mirror `update`: speed, own mean, expected, gap, variance;
   - mirror `suggestion`, returning a pair name or `null`, with ties going to the lower pair index as in Python;
   - add the nominal 80% range for a later mean of `m` intervals, `expected + gap ± RANGE_Z · sqrt(variance + sigma2/m)`. C1b's monitoring will use it.
   - Load the table so General practice never pays for it: by dynamic import, or from the call site C1b will add.
3. **Model parity.** Write a small Python generator (in `browser_table.py` or its test). Using the real fitted model, `update` and `suggestion`, it writes `ml/fixtures/coach-parity.json` with about 20 synthetic histories and their expected outputs.
   - Cover these histories: empty; a single sentence; typical speeds near 40, 80 and 120 WPM; around 190 WPM (above the support); below the support; a clear personal weak pair that is issued; a weak pair outside the 100 (not issued); a pair with one observation (not issued); and an exact tie in the ranking.
   - Add `typing-app/client/tests/coach-model.test.ts`: decisions match exactly, and floats agree within 1e-9.
4. **Eligibility parity (C2).** Add `typing-app/client/tests/eligibility-parity.test.ts`. Replay each of A2's 32 cases through `TypingEngine`, and compare eligibility and per-pair counts and log sums with the fixture's expected intervals.
   - Where the engine cannot represent a fixture event, say so in a short table in your report rather than forcing it.
   - If the engine disagrees with a case, do not change `engine.ts`: report the case, the difference and what users would see, then ask me.

## Owned paths

`ml/coach/browser_table.py`, `ml/tests/test_browser_table.py`, `ml/fixtures/coach-parity.json`, `typing-app/client/src/coach-model.ts`, `typing-app/client/src/generated/coach-model.json`, `typing-app/client/tests/coach-model.test.ts` and `typing-app/client/tests/eligibility-parity.test.ts`. Everything else is read-only.

## Done when

- `npm run check` passes in `typing-app/client`, and `python -m unittest discover -s ml/tests` passes.
- The exporter, run twice, gives identical bytes and the pinned digest.
- Your report is `artifacts/C1a.md`, at most about 60 lines: table size, parity results with counts, eligibility cases matched and not applicable, anything that disagrees, and the exact commands.
- Then send `worker_done` as `common.md` describes.
