# ML lane verification — 30 September 2026

## Executed real-data pipeline

All five CLI stages completed successfully with the genuine Aalto archive. Acquisition requested and obtained exactly **2,000 participant members**; no synthetic/reduced metrics substitute was used.

```sh
.venv/bin/python -m ml.pipeline acquire --participants 2000 --seed 42 --max-bytes 268435456
.venv/bin/python -m ml.pipeline audit
.venv/bin/python -m ml.pipeline train
.venv/bin/python -m ml.pipeline evaluate --split test
.venv/bin/python -m ml.pipeline export
.venv/bin/python -m unittest discover -s ml/tests -v
.venv/bin/python -m compileall -q ml
```

- Successful resumed acquisition: 36,931,979 range payload bytes; 244,573,106 expanded cached bytes. An earlier transient DNS failure was recovered through CRC-verified cache resume; its partial transfer is not included in that successful-invocation count.
- A later fully cached acquisition used 20,260,011 bytes (ZIP directory/footer reads), validated all cached CRCs and reproduced the identical manifest hash.
- Cached preprocessing repeated with identical derived-row hash.
- Frozen training repeated after test unlock **with identical inputs/config only**, producing exactly the same config hash and model parameters. No hyperparameter or cohort changes followed test inspection.
- The same frozen evaluation/seeded bootstrap was reproduced byte-equivalently under canonical JSON hashing. This was a reproducibility check, not another selection round.
- `ml/experiment.json` was generated from the selected config before the first test evaluation existed (asserted before unlock); subsequent evaluation verifies its config hash.
- Python: 21 offline tests pass. Compilation diagnostics pass. Domain executor independently reported 44 frontend tests including actual fitted-estimator→exported-browser parity (relative tolerance 1e-6), every feature, baseline/candidate predictions and synthetic event/history advancement. Parent owns final full-app verification.

## Cohort and primary result

- Acquired split before eligibility: 1,400 train / 300 validation / 300 test participants.
- Any eligible trial: 1386 participants, 5812 trials, 117653 observations, including reserved prompts.
- Nonreserved usable train: 936 participants / 65777 observations.
- Nonreserved validation: 193 participants / 13585 observations.
- Nonreserved test: 198 participants / 13555 observations.
- Frozen baseline: smoothed user/pair, k=1; full Ridge alpha=100.
- Preregistered primary (test/nonreserved/warm): 151 participants / 9595 observations.
- Participant-macro MAE: Ridge **61.297886 ms**, selected baseline **67.552904 ms**.
- Paired Ridge-minus-baseline difference **-6.255018 ms**, seeded participant-bootstrap 95% interval **[-7.761162, -4.893577] ms**.
- All three secondary slices are available; reserved-prompt train overlap is zero. Their observation-key sets were checked disjoint during evaluation.
- Pair-ranking metric is honestly unavailable: zero participants meet ≥8 observations/pair and ≥5 qualifying pairs. No substitute ranking score is displayed.

## Hashes and artifact paths

Canonical JSON SHA256:

- Source manifest: `3a756f95c07305c99179bbf1679639e9ec111d5c8e5aa2235df403bac404c30e`
- Derived rows: `eceba5f18baa5701eee86299dd87443bd851205e775a29d969da617779a28c6c`
- Frozen config: `83f562c419d5469f6da2888bc1608312947a4e20d67038e79759dee07aa90324`
- Evaluation: `92947653a001eb99842695cbccbcc4b4ebb71e866b885115a15087f5fd79226e`
- Model: `d0031abe000896fb8e2a110367bc0c045151213fafb348b431713cba3fef9e21`

Actual file-byte SHA256:

- `typing-app/client/src/generated/model.json`: `7ffce48105ac2dc9c9915d01f9277a7f4b7cfeca6d0377ce8d44a8d70536a836`
- `typing-app/client/src/generated/benchmark.json`: `3774d21303ec1c56b4467a333d4a759e64b521417dc2d4e44e04f3793e7bcef3`

Committed-candidate artifacts: `ml/pipeline.py`, `ml/requirements.txt`, `ml/README.md`, `ml/experiment.json`, `ml/tests/test_pipeline.py`, `ml/fixtures/parity.json`, and the two generated frontend JSON files. Fixtures are labelled synthetic and never enter metrics. `git check-ignore` confirms `.venv/` and `ml/data/` (including raw source, participant rows, source manifest and private observation-key manifests) are excluded.

Private local evidence: `ml/data/{acquire,audit,train,evaluate,export}.log`, cached reproduction logs, frozen `config.json`, `evaluation.json`, `evaluation-keys.json`, `audit.json` and final test logs. These are not source-control deliverables.

## Final synthetic boundary reinforcement

Three additional offline regressions exercise actual `evaluate()` with four exact disjoint observation-key slices, a one-participant primary with unavailable interval, and an absent primary that cannot borrow secondary metrics. Actual `train()` runs twice only on tiny synthetic temporary `DATA`/`ROOT` inputs: mutating held-out future/test and reserved-trial labels leaves fitted coefficients, intercepts, population defaults, baseline selection, alpha selection, validation scores and residual bounds unchanged (the input hash correctly changes).

The final 21-test suite and `compileall` both exited 0. Before/after file-byte hashes confirm the real generated model/report, parity fixtures, preregistration and private frozen config remain unchanged. No additional real-data selection or evaluation was performed for these tests.

## Scientific limits and stop condition

Public source has no composition/focus/key-repeat instrumentation flags. Blank/ambiguous LETTER mappings, malformed TSV and invalid UTF8 participant files are excluded conservatively; exact reconstructable copying is not claimed equivalent to the browser instrumentation. Correct-copy selection bias and speed/error coverage are explicit. Source license is non-commercial with attribution.

Despite the positive preregistered public-data result, the candidate stays **experimental**, the historical baseline remains the coach, and neither TypeForge transfer nor causal typing improvement is established. Independent consented pilot and public-release gates remain open. This ML implementation lane is complete; parent integration/review owns final slice completion.
