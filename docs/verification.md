# Local verification — 30 September 2026

The local-first slice has passing checks and a genuine trained artifact. Initial independent reviews returned REQUEST CHANGES / WATCH; their findings were repaired and preserved. Independent re-review on 30 September 2026 returned **APPROVE** from the code reviewer (35 product files) and **CLEAR** from the architect, with zero unresolved findings in the repaired local slice. This record is **not public-release approval**, competitor feature parity or proof that coaching improves typing.

## Reproduce the offline checks

After the [frontend setup](../README.md#run-locally) and [Python environment setup](../ml/README.md#reproduce), run from the repository root:

```sh
npm --prefix typing-app/client run test
npm --prefix typing-app/client run typecheck
.venv/bin/python -m unittest discover -s ml/tests -v
```

Windows uses `.venv/Scripts/python.exe`. Run the production build/preview commands in the frontend README for browser checks. Full genuine acquisition → audit → training → evaluation → export commands and scientific constraints are in the [ML reproduction guide](../ml/README.md); they are not CI jobs.

| Evidence | Recorded result |
| --- | --- |
| Environment | Node 24.21.0; Python 3.14.4; pinned dependency files |
| Client | 49 tests pass; TypeScript checking and Vite production build pass |
| Python | 21 offline tests pass; compilation diagnostics pass |
| Python/browser parity | All 682 feature values, actual fitted estimator versus exported predictions at relative tolerance 1e-6, baseline predictions, eligibility and rolling-history advancement |
| CI configuration | Frontend tests/typecheck/build, including bundled parity; offline Python tests; no acquisition/training |

Parity fixtures are explicitly synthetic tests, never benchmark observations. Coverage includes corrected/native edits, deadline boundaries, malformed artifacts, legacy/extended records, missing or incompatible retest origins, exhausted fresh passages and immutable prediction/history snapshots. See [client tests](../typing-app/client/tests), [Python tests](../ml/tests/test_pipeline.py) and the [CI workflow](../.github/workflows/check.yml).

## Current browser evidence

Scoped automation used **Chromium 155.0.8059.12**, a production preview and isolated browser contexts. The review-repair follow-up verified production bundle `app-BNbtYIKA.js`. Synthetic history and storage/artifact fault injection stayed in those contexts, separate from real benchmark data and user history.

- Native middle insertion/selection replacement, blocked paste, blur notice, restart, idle focus/empty Enter and the 60-second deadline pass. Three successive Enter submissions also pass with a real clock, without clock mocking.
- Assessment → saved/reloaded result → general practice → reopened fresh retest preserves its assessment origin and excludes every original passage, including the partial final prompt. Missing/deleted origins explain the new-assessment fallback.
- An active run keeps its original snapshot after cross-tab deletion. Restart reloads a fresh bounded calibration snapshot with input disabled during loading. After cross-tab deletion, the new practice run drops the deleted focus; a restarted retest whose origin was deleted explains the new-assessment fallback and saves no stale origin. Undeclared QWERTY opens zero calibration cursors. The temporary newest-ten summary bound is supported by source/unit checks, not inferred from browser behaviour alone.
- A separately seeded supported-focus case verifies baseline targeting, two-target/one-general cadence and saved focus/origin. Both predictors remain matched to later eligible observations; the candidate stays experimental.
- IndexedDB v1→v2 retains 122 original records, including corrupt/unindexable records; validation exposes a warning. Pagination returns 120 valid unique descending rows across the 100-row boundary. Quota failure preserves the result, export and retry; unavailable storage is labelled.
- Isolated response mutations cover missing/malformed models and missing/mismatched reports. Cold missing-model runs remain explicitly unavailable; warm missing-model runs use only an observed-history baseline, never an invented population default. Typing works and Lab withholds unavailable or mismatched metrics. Each missing/report mutation asserts it changed the exact bundled entry; no static artifact files were removed.
- A stored finite prediction with unrepresentable log mean 10000 is visibly skipped, not rendered as Infinity/NaN. All 123 records remain stored, including invalid/unindexable entries; 120 valid records still render. The real Lab shows the shipped versions, counts, baseline comparison and uncertainty.
- A loaded session works offline; the typing journey makes no prediction API or guest-keystroke upload request. Offline reload is not supported.
- Core layout checks at **1440×900** and **390×900** find no page-level horizontal overflow. Additional result/progress/Lab checks pass at **390×844**. The leader visually inspected populated results/progress at 1440px/390px and actual home/practice/Lab desktop/narrow captures; no page-level overflow was found.
- Scoped label/focus, timer semantics, reduced-motion and CSS `zoom:2` checks pass. Nine static solid-palette colour pairs reach at least 4.5:1 contrast; this is not a complete rendered-state accessibility audit.
- Static subpath smoke checks for `/TypeForge/index.html`, `practice.html`, `progress.html` and `lab.html` load expected headings/assets with no page errors or HTTP responses ≥400. This is local hosting evidence, not a deployed public site.

Current review-repair groups contain **10 restart, 7 storage, 12 focus, 16 journey, 30 core and 18 artifact/storage passing assertions**, plus the real-clock Enter regression. The earlier final-Lab group recorded 12 passes. Groups overlap; their sum is **not** a count of independent scenarios. Browser QA found and preserved the initial monotonic-clock Enter failure and, later, a stale deleted-origin Restart failure; repairs pass fresh regressions. Initial review findings and failed raw runs remain recorded rather than relabelled as passes.

For a manual repeat, serve the production build, use a fresh browser profile, complete an assessment with several correct submitted sentences, reopen its saved result, follow practice and fresh retest, and inspect progress and ML Lab. Repeat at the documented viewport sizes; check native edits, blur/restart, export/delete and offline completion after loading. Fault injection, controlled-clock deadlines and v1 database seeding require a browser automation harness.

The original automation scripts and raw outputs live under **local, ignored** `.omx/ultragoal/evidence/browser/`; they use the Playwright MCP `browser_run_code_unsafe` tool and are not a standalone published npm test suite. Local `REPORT.md` and `REVIEW-REPAIR-REPORT.md` explain execution and preserve initial failures as well as successful reruns. This public document summarizes those results; it does not imply the ignored logs ship with the repository. [Home](screenshots/home-desktop.png), [practice](screenshots/practice-desktop.png) and [ML Lab](screenshots/ml-lab-desktop.png) screenshots are unchanged captures of the actual app.

## Genuine data and frozen result

Acquisition obtained **2,000 participants**, split before eligibility into 1,400 train / 300 validation / 300 test. Conservative eligibility retained **1,386 participants, 5,812 trials and 117,653 transitions**, including reserved prompts. Nonreserved train/validation/test coverage is respectively 936/193/198 participants and 65,777/13,585/13,555 transitions.

The preregistered primary test/nonreserved/warm slice contains **151 participants / 9,595 transitions**. Participant-macro MAE is **61.297886 ms** for Ridge and **67.552904 ms** for the validation-selected smoothed-pair baseline (k=1). The paired Ridge-minus-baseline difference is **−6.255018 ms**, with participant-bootstrap 95% interval **[−7.761162, −4.893577] ms**. Ranking is unavailable: no participant meets the pair-support thresholds. Secondary slices, exclusions and limitations remain visible in the [generated benchmark](../typing-app/client/src/generated/benchmark.json).

Cached preprocessing, unchanged frozen training and seeded evaluation reproduced the same canonical hashes; this was not a second model-selection round. [ML verification](../ml/VERIFICATION.md) records acquisition/reproduction evidence and limitations. Model `aalto-ridge-83f562c419d5` links to report `benchmark-92947653a001`.

| Canonical JSON SHA256 | Value |
| --- | --- |
| Source manifest | `3a756f95c07305c99179bbf1679639e9ec111d5c8e5aa2235df403bac404c30e` |
| Derived rows | `eceba5f18baa5701eee86299dd87443bd851205e775a29d969da617779a28c6c` |
| Frozen config | `83f562c419d5469f6da2888bc1608312947a4e20d67038e79759dee07aa90324` |
| Evaluation | `92947653a001eb99842695cbccbcc4b4ebb71e866b885115a15087f5fd79226e` |
| Model | `d0031abe000896fb8e2a110367bc0c045151213fafb348b431713cba3fef9e21` |

Actual file-byte SHA256 differs from canonical JSON hashing:

- [model.json](../typing-app/client/src/generated/model.json): `7ffce48105ac2dc9c9915d01f9277a7f4b7cfeca6d0377ce8d44a8d70536a836`
- [benchmark.json](../typing-app/client/src/generated/benchmark.json): `3774d21303ec1c56b4467a333d4a759e64b521417dc2d4e44e04f3793e7bcef3`

Raw/participant-level data stays ignored. The Aalto source requires **non-commercial use with attribution**; see the [source and license notes](../ml/README.md#source-and-acquisition). Public instrumentation lacks browser focus/composition/repeat flags; conservative correct-copy selection is not proof of equivalent measurement. These results establish neither TypeForge transfer nor causal typing improvement. The historical baseline remains the coach.

## Remaining gates and compatibility

- Firefox, Safari, physical-keyboard/mobile-IME testing, screen-reader interaction and human usability remain untested. CSS zoom is a layout proxy, not browser-chrome zoom certification. No complete accessibility/contrast audit or universal timing-precision claim follows.
- Core responsive result/progress automation used empty states; separate populated result/progress visual inspection now passes, but a populated five-assessment trend has not received equivalent visual certification. Artifact/report browser coverage uses exact isolated response mutations, not separately built artifact-free apps. Incompatible/exhausted origins and fine-grained late commits have domain checks, not equivalent complete browser coverage; legacy-origin browser coverage remains a gap.
- Storage checks cover the tested upgrade/pagination boundary, not arbitrarily large databases or eviction durability.
- Accounts/private cloud sync, the independently consented 15–20-person transfer pilot and public launch remain subsequent milestones. No production services or account isolation are certified by this local slice.
- IndexedDB upgrades to database version 2 without rewriting old records. Old database-v1 apps cannot reopen that database and may reject extended records. **Export before downgrading.** Result schemaVersion and metricVersion remain 1.

See the [roadmap](../PLAN.md) for the broader release gates. Local checks and independent reviews pass; accounts, cloud sync, the consented pilot and public release remain unfinished. Initial and final review reports remain local evidence, not a published browser-test suite or an approval of those subsequent milestones.
