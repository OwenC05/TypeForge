# TypeForge model-driven coach: plan and task graph

24 November 2026. Coordinator: Claude (Opus 5.5) in the `typeforge-daily-practice` workspace. Workers: Codex `gpt-6.2-astra`, effort max, each in its own Orca child worktree. Owen delegated the plan decisions below to the coordinator on 24 November 2026.

## Why

The coach accepted on 18 November is a fixed rule that uses no model. It can suggest only `he`, `in`, `le`, `th`, which are among most typists' fastest pairs, so it rarely fires (13 of 200 Aalto typists even with looser evidence requirements than shipped; see `ml/probes/coach_probe.py`). A "slower than your own average" contrast mostly measures the keyboard (`ed` clears 1.25x for 72% of typists). After removing each pair's population difficulty, a typist's remaining gap repeats across the two halves of a session (r about 0.46, 164 typist-pair cells). Sentence-level eligibility discards about two-thirds of clean intervals (`ml/probes/salvage_probe.py`: 2.86x more intervals when clean intervals inside corrected sentences are kept; A2 later found those intervals run slower, see D2). The model has seen almost no fast typists (3 test typists above 100 WPM; Owen types about 190). The full archive has one typist above 150 WPM and none above 180 (A8).

Goal: give the model a real job, "what is expected for a typist at your speed", coach on the personal gap from that expectation, monitor the model on the user's own typing, and test whether practice helps with a randomised within-person design. Then tell the story honestly.

## Decisions (made by the coordinator under Owen's delegation)

- D1 Process receipts (`docs/implementation/**`, `docs/reviews/**`, about 2,240 files and 80 MB) move to a local branch `archive/process-receipts-2026-11`; the main line keeps a short `docs/process/` summary. Pushing waits for Owen.
- D2 (revised 24 November after A2) Eligibility stays clean-copy. A2's pre-set test required every 95% interval within ±2% across speed bands and distances from a correction. All 36 windows failed it, and sentences containing a correction run about 2% slower even far from it. Metric v2 is therefore the clean-copy rule, which the browser engine already applies (any wrong character or edit discards the sentence's pairs). So there is no metric version change, no baseline restart and no migration. One question stays open: do intervals from corrected sentences still help the coach pick the right pairs despite that small bias? B4 tests this once as a pre-registered secondary comparison. Only a clear gain there would justify a later rule change.
- D3 Practice text: an openly licensed corpus filtered by deterministic checks first. LLM generation only if filtering misses the density targets, and then with an open model on hardware Owen controls, never a paid API. Not in this wave.
- D4 Pilot: prepare the pre-registration, power simulation, consent, recruitment and protocol; Owen runs it on himself first; recruiting volunteers stays Owen's call.
- D5 Deployment: Vercel builds production from GitHub `main` (README, "Public demo deployment"). PR #1 merged on 19 November, so production is current. Nothing is pushed, merged or deployed without Owen's approval.
- D6 Lightweight records: one coordination file, one short report per task, no raw-log receipts in git.
- D7 Design: Codex workers implement UI against `DESIGN.md`; the Claude coordinator makes the design calls and reviews screenshots (Owen's rule that design judgements come from real Claude).
- D8 Python runs in WSL with Python 3.14 to match CI. No DVC: Owen rejected it on 24 November because it does nothing for profiling typists or choosing practice, and the pipeline's hashed inputs and frozen config already give the reproducibility it would add. Infrastructure must earn its place through the model or the user.

- D9 Lean (Owen, 24 November: "keep the project lean, we shouldnt build anything we dont need to unless it adds value to typeforge"). Build only what improves how TypeForge profiles a typist, chooses practice, tests whether practice helps, or fixes a defect users hit. Applied the same day: DVC dropped; A6 stopped (it would have monitored a model that drives nothing; monitoring is built once, inside the new coach); A5 lost its process page and roadmap doc; A7 lost the consent and recruitment documents and gained a single-person design; A3 builds the smallest banks that meet the targets; the ladder lost gradient-boosted trees; the coach lost shadow mode; the heatmap is dropped unless the coach UI needs it; write-ups shrink to a short model card.
- D10 Speed support (24 November, after A8). The full archive's training typists stop near 150 WPM (1,828 at 100+, one at 150+, none at 180+), and Owen types about 190, so any expectation at his speed is an extrapolation. B4 sets the supported speed range from the training data and fixes a rule for faster typists. For example: hold the pair pattern at the boundary, take the level and personal gaps from the typist's own data, and widen the prior. B4 measures the cost by fitting the speed terms without the fastest typists and scoring them. Above the supported range, the coach's monitoring in C1 is the only check.
- D11 Phase B shape (24 November, after A2 and A8). B1 merges into B3 (one dataset build using A2's rule). B2 is dropped: the browser already applies the rule, so checking the engine against A2's 32 shared fixtures moves into C2.
- D12 Fresh-test scope (24 November, after B5's review). B5 reproduced B4's validation results independently and approved with changes. All four are accepted. (1) A committed B6 driver builds and scores the fresh data. It is pinned in the registration and dry-run on validation before anything is unlocked. (2) A pass is a claim about prediction. L5 predicts a typist's later pair timing better than their own average, so it may choose the coach's pairs, here and in a practice trial. It does not show that practising those pairs helps, or that L5's pairs beat the current rule. B5 recommended a head-to-head trial before replacing the rule; I decline that one part. The current rule mostly measures keyboard difficulty and covers four pairs. On Aalto histories it never reached its data threshold. A local-first app also cannot run a shadow comparison. So C1 replaces the rule after a pass, claims only what was measured, and leaves the practice question to the trial. (3) A frozen, descriptive reference rule (raw slowest pair at matched issuance) is added for the coaching rates. (4) A decision needs at least 800 scored typists, and binary rates get exact binomial intervals.

## The model (shared design for phase B; workers refine, coordinator approves)

- Unit: clean within-word lowercase letter-pair interval, keydown to keydown, log milliseconds, eligibility v2.
- Speed `s_u`: the typist's own typical log interval over eligible pairs, adjusted for pair mix (for example the mean of `y - a_p`), so pair-dense practice text does not shift it; computable in the browser from the same data. In evaluation it comes from the earlier half only: the source's `AVG_WPM_15` uses every sentence and would leak the scored half (it may still group typists into reporting bands).
- Population expectation: `E[y | pair p, speed s] = a_p + b_p (s - s_bar)` with shrinkage of rare pairs.
- Personal gap: `d_up`, prior N(0, tau_p^2), residual variance sigma_p^2; closed-form posterior after n observations, updatable after every sentence.
- Coach score: expected time lost per 1,000 typed characters, `f_p * E[interval] * (exp(d_hat) - 1)`, with `f_p` the pair's frequency in general English text; suggest only when the posterior probability of a real gap clears a threshold fixed in advance.
- Browser artifact: a per-pair table (`a_p, b_p, tau_p, sigma_p, f_p`), `s_bar`, version and provenance.
- Ladder compared identically: L0 population pair mean; L1 own average (the current rule's family); L2 pair by speed; L3 current Ridge (already built); L5 partial pooling (L2 plus shrunken personal gap). No gradient-boosted trees: they cannot ship as a table the browser updates after every sentence, so they would exist only to be compared.
- Evaluation, pre-registered before a fresh test set is opened: within each held-out typist, fit on the earlier half and score the later half. Metrics: participant-macro MAE; weakest-pair recovery (precision at 3, Spearman); suggestion stability across halves; coverage of nominal 80% ranges; coach yield. Results by speed band, including 100+ WPM, plus the D10 extrapolation check and the D2 secondary comparison. Aalto typists have about four clean sentences each (393,065 eligible trials over 93,615 training typists), so only typist-pair cells with a pre-set minimum count in both halves are scored; report how many qualify and what that implies for real users, whose histories are longer. The winner must beat L1 on the pre-registered primary metric by a margin fixed in advance. The 2,000-participant subset's test split is never reused for selection; the fresh test set comes from the full archive and excludes all 2,000 previously acquired participants.

## Task graph

Phase A (now, parallel):

| ID | Task | Owns | Depends on |
| --- | --- | --- | --- |
| A1 | ML package: split `ml/pipeline.py` into tested modules with a data-dir parameter, so the modelling work builds on it; byte-identical outputs (DVC dropped 24 Nov) | `ml/**` except reserved dirs | none |
| A2 | Eligibility v2: post-error bias analysis, exact rule spec, shared conformance fixtures, Python reference | `ml/analysis/**`, `ml/specs/**`, `ml/eligibility_v2.py`, its test, `ml/fixtures/eligibility-v2.json` | none |
| A3 | Practice and assessment banks v2 from an openly licensed corpus; pair frequencies | `ml/corpus/**`, new bank JSON under `src/generated/` | none |
| A4 | Fix the two P3 UI issues (red/green) | client source and tests named in brief | none |
| A5 | Archive receipts, one-screen README with at most two fresh screenshots, long content moved to `docs/product.md` (trimmed under D9) | `README.md`, `docs/**` except `docs/pilot/**` | none |
| A6 | Stopped under D9 before it started; monitoring moves into C1 | none | none |
| A7 | Pilot: pre-registration draft with a multi-person and a single-person (n-of-1) design, power simulation; consent and recruitment deferred until Owen picks a design | `docs/pilot/**`, `ml/pilot/**` | none |
| A8 | Full archive: download, verify, inventory, streaming ingest, fresh locked split | `ml/full_archive/**`; data outside git | none |
| A9 | Firefox and WebKit verification of the production build | browser harness, local compat fixes | A4 |

Phase A was merged into `feature/daily-practice` on 24 November; A9 is still running.

Phase B (shape per D11; briefs `B3-dataset.md`, `B4-coach-model.md`, `B7-banks-in-app.md`):

| ID | Task | Owns | Depends on |
| --- | --- | --- | --- |
| B3 | Full-archive train and validation datasets built with A2's rule, plus corrected-sentence intervals for validation typists (for the D2 comparison) | new dataset stage in `ml/`, its test, a short `ml/README.md` section; data outside git | A1, A2, A8 |
| B4 | Model ladder, D10 speed rule, coach replay on train/validation, fresh-test pre-registration | `ml/coach/**`, `ml/tests/test_coach*.py` | B3 (design, code and synthetic tests start in parallel) |
| B5 | Independent review of B4's pre-registration and code | review report | B4 |
| B6 | Fresh-test unlock, final evaluation, browser table export | `ml/coach/**`, generated table | B5 |
| B7 | v2 banks in the app: assessments and Pair mode; General and the current coach unchanged | client source and tests, `ml/corpus/test_banks.py` | A3, A9 |

Phase C: C1 model-driven coach in the browser (B6, B7). If B6 passes, it replaces the current rule, and the old rule's code is removed (D12). There is no shadow mode, because a local-first app has no telemetry to compare them with. The coach says only what B6 measured: a pair is slower than expected at this typist's speed. Whether practising that pair helps is for the trial (D1) to show. C1 includes monitoring, built once for the model the coach uses: the coach falls back to General practice when the model's expectations do not fit this user's own recent typing, and the Lab shows one short readout of that check. The top personal gaps are shown as plain text; a keyboard heatmap only if that proves unclear. C2 parity: the browser engine against A2's 32 eligibility fixtures, and Python/TypeScript fixtures for coach decisions.

Phase D: D1 in-app pilot support, only as much as the design Owen picks needs (C1, A7); D2 a short model card in `ml/README.md` (the research note, walkthrough and portfolio case study belong to the Portfolio workstream, not this repository); D3 final README refresh, full verification, PR prepared for Owen.

## Gates

- Every worker: tests green, concise report, commits on its own branch. The coordinator reviews and integrates into `feature/daily-practice`.
- UI work: screenshots reviewed by the Claude coordinator before integration.
- ML: no fresh-test number exists until B5 approves the frozen pre-registration.
- Owen approves before any push, PR, merge to `main` or deployment.
