# TypeForge model-driven coach: plan and task graph

24 November 2026. Coordinator: Claude (Opus 5.5) in the `typeforge-daily-practice` workspace. Workers: Codex `gpt-6.2-astra`, effort max, each in its own Orca child worktree. Owen delegated the plan decisions below to the coordinator on 24 November 2026.

## Why

The coach accepted on 18 November is a fixed rule that uses no model. It can suggest only `he`, `in`, `le`, `th`, which are among most typists' fastest pairs, so it rarely fires (13 of 200 Aalto typists even with looser evidence requirements than shipped; see `ml/probes/coach_probe.py`). A "slower than your own average" contrast mostly measures the keyboard (`ed` clears 1.25x for 72% of typists). After removing each pair's population difficulty, a typist's remaining gap repeats across the two halves of a session (r about 0.46, 164 typist-pair cells). Sentence-level eligibility discards about two-thirds of clean intervals (`ml/probes/salvage_probe.py`: 2.86x more intervals when clean intervals inside corrected sentences are kept). The model has seen almost no fast typists (3 test typists above 100 WPM; Owen types about 190).

Goal: give the model a real job, "what is expected for a typist at your speed", coach on the personal gap from that expectation, monitor the model on the user's own typing, and test whether practice helps with a randomised within-person design. Then tell the story honestly.

## Decisions (made by the coordinator under Owen's delegation)

- D1 Process receipts (`docs/implementation/**`, `docs/reviews/**`, about 2,240 files and 80 MB) move to a local branch `archive/process-receipts-2026-11`; the main line keeps a short `docs/process/` summary. Pushing waits for Owen.
- D2 Interval-level eligibility is accepted as metric version 2. Old records stay readable; v1 and v2 data are never mixed in comparisons; baselines restart under v2.
- D3 Practice text: an openly licensed corpus filtered by deterministic checks first. LLM generation only if filtering misses the density targets, and then with an open model on hardware Owen controls, never a paid API. Not in this wave.
- D4 Pilot: prepare the pre-registration, power simulation, consent, recruitment and protocol; Owen runs it on himself first; recruiting volunteers stays Owen's call.
- D5 Deployment: Vercel builds production from GitHub `main` (README, "Public demo deployment"). PR #1 merged on 19 November, so production is current. Nothing is pushed, merged or deployed without Owen's approval.
- D6 Lightweight records: one coordination file, one short report per task, no raw-log receipts in git.
- D7 Design: Codex workers implement UI against `DESIGN.md`; the Claude coordinator makes the design calls and reviews screenshots (Owen's rule that design judgements come from real Claude).
- D8 Python runs in WSL with Python 3.14 to match CI. No DVC: Owen rejected it on 24 November because it does nothing for profiling typists or choosing practice, and the pipeline's hashed inputs and frozen config already give the reproducibility it would add. Infrastructure must earn its place through the model or the user.

## The model (shared design for phase B; workers refine, coordinator approves)

- Unit: clean within-word lowercase letter-pair interval, keydown to keydown, log milliseconds, eligibility v2.
- Speed `s_u`: the typist's own typical log interval over eligible pairs, computable in the browser from the same data.
- Population expectation: `E[y | pair p, speed s] = a_p + b_p (s - s_bar)` with shrinkage of rare pairs.
- Personal gap: `d_up`, prior N(0, tau_p^2), residual variance sigma_p^2; closed-form posterior after n observations, updatable after every sentence.
- Coach score: expected time lost per 1,000 typed characters, `f_p * E[interval] * (exp(d_hat) - 1)`, with `f_p` the pair's frequency in general English text; suggest only when the posterior probability of a real gap clears a threshold fixed in advance.
- Browser artifact: a per-pair table (`a_p, b_p, tau_p, sigma_p, f_p`), `s_bar`, version and provenance.
- Ladder compared identically: L0 population pair mean; L1 own average (the current rule's family); L2 pair by speed; L3 current Ridge; L4 gradient-boosted trees; L5 partial pooling (L2 plus shrunken personal gap).
- Evaluation, pre-registered before a fresh test set is opened: within each held-out typist, fit on the earlier half and score the later half. Metrics: participant-macro MAE; weakest-pair recovery (precision at 3, Spearman); suggestion stability across halves; coverage of nominal 80% ranges; coach yield. Results by speed band, including 100+ WPM. The winner must beat L1 on the pre-registered primary metric by a margin fixed in advance. The 2,000-participant subset's test split is never reused for selection; the fresh test set comes from the full archive and excludes all 2,000 previously acquired participants.

## Task graph

Phase A (now, parallel):

| ID | Task | Owns | Depends on |
| --- | --- | --- | --- |
| A1 | ML package: split `ml/pipeline.py` into tested modules with a data-dir parameter, so the modelling work builds on it; byte-identical outputs (DVC dropped 24 Nov) | `ml/**` except reserved dirs | none |
| A2 | Eligibility v2: post-error bias analysis, exact rule spec, shared conformance fixtures, Python reference | `ml/analysis/**`, `ml/specs/**`, `ml/eligibility_v2.py`, its test, `ml/fixtures/eligibility-v2.json` | none |
| A3 | Practice and assessment banks v2 from an openly licensed corpus; pair frequencies | `ml/corpus/**`, new bank JSON under `src/generated/` | none |
| A4 | Fix the two P3 UI issues (red/green) | client source and tests named in brief | none |
| A5 | Archive receipts, `docs/process/`, one-screen README, fresh screenshots, `docs/roadmap.md` | `README.md`, `docs/**` except `docs/pilot/**` | none |
| A6 | "Model on your typing" monitoring panel in the ML Lab | `src/monitoring.ts`, Lab region of `app.ts`, `lab.html`, appended CSS | none |
| A7 | Pilot: pre-registration draft, power simulation, consent, recruitment, protocol | `docs/pilot/**`, `ml/pilot/**` | none |
| A8 | Full archive: download, verify, inventory, streaming ingest, fresh locked split | `ml/full_archive/**`; data outside git | none |
| A9 | Firefox and WebKit verification of the production build | browser harness, local compat fixes | A4 |

Phase B (after the inputs land): B1 eligibility v2 in the Python package (A1, A2); B2 eligibility v2 in the browser engine with metric version 2 (A2, A4); B3 full archive in the package and DVC (A1, A8); B4 model ladder and coach replay on train/validation, with a pre-registration of the fresh-test evaluation (B1, B3); B5 independent review of B4's pre-registration and code; B6 fresh-test unlock, final evaluation and browser table export (B5); B7 bank v2 integration in the app (A3).

Phase C: C1 model-driven coach in the browser, run in shadow beside the current rule before switching (B6 or a provisional table, B2, B7); C2 keyboard heatmap of personal gaps; C3 Python/TypeScript parity fixtures for coach decisions.

Phase D: D1 in-app pilot support (C1, A7); D2 model card, research note, case-study draft for the Portfolio workstream (never edit Portfolio from here), walkthrough script; D3 final README refresh, full verification, PR prepared for Owen.

## Gates

- Every worker: tests green, concise report, commits on its own branch. The coordinator reviews and integrates into `feature/daily-practice`.
- UI work: screenshots reviewed by the Claude coordinator before integration.
- ML: no fresh-test number exists until B5 approves the frozen pre-registration.
- Owen approves before any push, PR, merge to `main` or deployment.
