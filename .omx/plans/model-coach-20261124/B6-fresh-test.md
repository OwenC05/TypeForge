B6 Open the fresh test set once and report the registered result

Read `.omx/plans/model-coach-20261124/common.md` and `plan.md` first, especially D12. You are worker B6. No port. Python runs in WSL as `common.md` describes. WSL sometimes times out at startup (`Wsl/Service/0x8007274c`). Retry once before treating that as a failure; a WSL startup timeout is not a run of the command.

Owen's direction: keep TypeForge lean. This task runs one pinned command and reports its result. Change no code.

## Why

`ml/coach/PREREG.md` (Git LF SHA256 `8acabf31d6eefef24341550d1eef5ab2e95125d82d8f084b3925fedaa266f5ae`) fixes how the fresh assignment of 16,659 typists is scored, and the independent review (`ml/coach/REVIEW.md`) approved it. The fresh set can be opened only once. Anything decided after seeing it would invalidate the test. So run the registered command exactly once, record what it produces and report it plainly, whatever the outcome.

## Run

1. Check that your worktree is clean and includes the registration and driver: `git show HEAD:ml/coach/PREREG.md | sha256sum` gives the hash above, and `493aee5` is an ancestor of HEAD.
2. From the worktree root in WSL, run once:
   `OPENBLAS_NUM_THREADS=1 PYTHONDONTWRITEBYTECODE=1 /mnt/c/Users/Owenc/Documents/GitHub/TypeForge/.venv/bin/python -m ml.coach.b6 fresh /home/owenc/typeforge-data/aalto-136m /mnt/c/Users/Owenc/Documents/GitHub/TypeForge/ml/data/raw/metadata_participants.txt /home/owenc/typeforge-data/aalto-136m/coach-fresh-results.json`
   The metadata file sits in the original checkout. Read it there; never write anything in that checkout.
3. If the command stops on a verification error before scoring, do not change code, inputs or the command, and do not try again. Send an escalation with the exact error and wait. Do the same for any other failure.
4. Do not run anything else on the fresh data: no extra analyses, plots or reruns. The registered outputs are the result.

## Report

- Check the results JSON for participant or session identifiers. If it holds only aggregates, commit a copy as `ml/coach/fresh.json`. If it holds identifiers, commit nothing from it and ask me.
- Add a short "Fresh test" section at the top of `ml/coach/REPORT.md`, at most about 40 lines, in the report's plain style:
  - the registered decision (pass, fail or `fail_insufficient_data`) and its paired interval, with scored and assigned typists;
  - the secondary results with denominators, including the matched comparator;
  - the derived file's SHA256 and the exact command;
  - what the result does and does not show, in D12's terms.
- Then send `worker_done` as `common.md` describes, with the decision and the primary interval in its body.

## Owned paths

`ml/coach/REPORT.md` and `ml/coach/fresh.json`. Everything else is read-only.
