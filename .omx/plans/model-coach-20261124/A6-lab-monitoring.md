A6 "Model on your typing": monitoring panel in the ML Lab

Read `.omx/plans/model-coach-20261124/common.md` and `plan.md` first. You are worker A6. Port 5343.

## Why

Owen's named experience gap is model monitoring. The app already freezes predictions before each sentence and later stores the observed timings, so it can show how the model is doing on this user's own typing, entirely on-device. Today the ML Lab shows only public-data benchmark results.

## Build

1. Pure module `typing-app/client/src/monitoring.ts` (no DOM), computing from stored `SessionResult` records with the existing compatibility rules (same model version, metric version, declared QWERTY, language, corpus):
   - Error over time: for each eligible sentence with frozen predictions, compare predicted with observed pair timing for the experimental candidate and for the historical baseline. Report participant-level MAE in milliseconds over the last 50 eligible sentences and as a time series (per session).
   - Calibration: the share of observations inside the predicted 80% range. First establish what is stored: the artifact's validation residual q10/q90 describe single transitions, and results store per-pair counts and log sums. Use a definition that is statistically correct for what is stored (for example, a range for a mean of n transitions), and say exactly what it is. If a correct definition needs data that is not stored, propose the smallest additive, validated, backward-compatible storage change and ask the coordinator before making it.
   - Distribution shift: the user's speed against the training typists. If `src/generated/benchmark.json` has no speed distribution, show the user's own trend and an explicit "training distribution not in this artifact" note, and record what the phase B export must add.
   - Alert rule, stated in code and in the UI copy, conservative and display-only in this phase: for example, flag when, over the last 50 eligible sentences with at least 200 transitions, the candidate is worse than the baseline with a paired sign test p < 0.05, or coverage falls below 60% against a nominal 80%. Choose the thresholds, justify them in your report, and never change coaching behaviour.
2. UI: a "Model on your typing" section in the ML Lab (`lab.html` and the Lab rendering in `app.ts`). Design direction from the Claude coordinator: one compact section above the public benchmark; three figures with plain labels (model error against baseline on your last 50 sentences, range coverage against the nominal 80%, your speed against training typists); one small line chart of rolling error for model and baseline, using the existing SVG chart approach in `app.ts`; an empty state that says how many more eligible sentences are needed; the alert state worded calmly ("The model is less accurate than the baseline on your recent typing; coaching does not use it."). Follow `DESIGN.md` tokens, type and spacing; no colour-only encoding; give the chart a text equivalent; keep it readable at 390 px.
3. Tests: unit tests in `typing-app/client/tests/monitoring.test.ts` (no data, legacy records without predictions, mixed model versions, one sentence, extreme values, alert on and off); `npm run check`. A browser check `tests/browser/lab-monitoring.mjs` that seeds a synthetic IndexedDB (conventions in `tests/browser/README.md`) and captures screenshots at 1440 and 390 px wide of the empty, populated and alert states into `artifacts/` (do not commit them; the coordinator reviews them from your report's paths).

## Owned paths

`src/monitoring.ts`, `tests/monitoring.test.ts`, `tests/browser/lab-monitoring.mjs`, `lab.html`, the Lab rendering region of `src/app.ts`, and a new clearly marked section appended to `src/style.css`. Another worker (A4) edits practice input handling and the results label in `app.ts` at the same time; stay out of those code paths.

## Done when

`npm run check` passes, the browser check passes, the report `typing-app/client/MONITORING-REPORT.md` (at most about 150 lines: definitions, thresholds and why, what is and is not measured, screenshot paths) is committed, and `worker_done` follows common.md.
