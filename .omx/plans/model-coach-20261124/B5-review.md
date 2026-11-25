B5 Independent review of the coaching model and its fresh-test registration

Read `.omx/plans/model-coach-20261124/common.md` and `plan.md` first, especially "The model", D2, D10 and D11. You are worker B5. No port. Python runs in WSL as `common.md` describes, with `OPENBLAS_NUM_THREADS=1`. WSL sometimes times out at startup (`Wsl/Service/0x8007274c`). Retry once before treating that as a failure.

## Why

B4 chose a coaching model on validation data and froze how the fresh test set will be scored, in `ml/coach/PREREG.md` (SHA256 `b02c11bae561d7a6fef0f071e73b1c04969e534d545014a6ad1f2be772edcfde`). The fresh test set holds 16,659 typists and has never been opened. Once B6 opens it, nothing can change. You are the last check that the registration is sound, that the code does what it says, and that nothing leaked. You wrote none of it, so review it as a sceptical outsider.

## Material

- B4's work, merged at `f0c03e4`: `ml/coach/PREREG.md`, `ml/coach/REPORT.md`, `ml/coach/validation.json`, the code in `ml/coach/` and `ml/tests/test_coach.py`.
- Inputs pinned in the registration: B3's datasets, A3's pair frequencies and the frozen Ridge. B3's datasets contain only train and validation. Never open fresh or legacy test data.

## Questions to answer

1. Leakage and isolation.
   - Do population parameters come only from train?
   - Do each validation typist's personal parts, speed and suggestion use only their earlier half?
   - Are the hit-rate labels independent of the earlier half?
   - Could anything in the scorer touch the fresh assignment before B6?
2. Fidelity. Does the code implement the registration exactly?
   - Re-derive at least L1 and L5 MAE, the paired L1 − L5 interval and the coach suggestions with your own independent code on validation.
   - Rerun B4's validation command, and check that `validation.json` and the fitted-model digest reproduce.
3. Executability. Could B6 run the registration mechanically, with no judgement calls? Include how B6 will produce the fresh derived file the scorer needs, and with which pinned code. List any ambiguity, any unhandled edge case (an empty half, missing pairs, a typist without speed, ties) and any input that is not pinned.
4. Scientific adequacy.
   - Does the primary gate answer a question that matters for the product: does the model-driven coach choose better practice than what TypeForge does now?
   - Are the comparators, margins and minimum counts appropriate?
   - Do the secondary rates (hit rate, yield, stability) have reference points that make them interpretable?
   - Does the report claim anything the design cannot support, such as results for fast typists, typists near 190 WPM or longitudinal use?
5. For each problem, give its severity (blocks B6, should be fixed before B6, or a note for later) and the smallest concrete change.

## Output

Write `ml/coach/REVIEW.md`, at most about 120 lines, containing:

- a verdict: APPROVE, APPROVE WITH CHANGES or REJECT;
- findings with evidence (file and line, and numbers you reproduced);
- the exact changes required before B6.

Do not edit B4's files. If changes are needed, I will have them made, and I may ask you to re-check. Keep any independent check scripts in the gitignored `artifacts/` folder, and commit only `REVIEW.md`.

## Done when

`REVIEW.md` is committed and `python -m unittest discover -s ml/tests` passes. Then send `worker_done` as `common.md` describes, with the verdict in its body.
