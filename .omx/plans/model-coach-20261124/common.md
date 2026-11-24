# Rules for every worker in the model-coach phase

Read this file and `plan.md` (same folder) before you start. Your task brief is your Orca task spec. If the brief and this file disagree, the brief wins for its own scope.

## Context

TypeForge is a local-first typing app (Vite and vanilla TypeScript, IndexedDB, no backend, in `typing-app/client`) and an applied-ML portfolio project (offline Python in `ml/`, trained on the Aalto 136M Keystrokes data). This phase gives a trained model a real job in the product, measures it honestly and tests whether practice helps. The audience includes ML and AI engineering hiring managers, so clarity, rigour and clean code matter as much as features.

## Workspace and git

- You work in your own Orca child worktree, branched from `feature/daily-practice` at the commit that added this file. Commit only on your worktree's branch. Use small conventional commits (`feat(scope): ...`, `fix`, `test`, `refactor`, `docs`, `chore`).
- Never push, merge, rebase other branches, tag, open PRs or deploy. Pushing to GitHub `main` deploys production on Vercel. The coordinator integrates your branch.
- Never modify: the original checkout `C:\Users\Owenc\Documents\GitHub\TypeForge` (you may read its `ml/data` and run its `.venv` interpreter), the Portfolio repositories, other worktrees, global tool configuration or credentials.
- Edit only the paths your brief owns. If you need a change elsewhere, ask the coordinator and continue with independent parts meanwhile.
- Unless your brief owns them, do not edit `README.md`, `PLAN.md`, `DESIGN.md`, `docs/implementation/**`, `docs/reviews/**` or `.omx/**`.
- Reserved paths owned by other workers in this phase: `ml/analysis/**`, `ml/specs/**`, `ml/eligibility_v2.py`, `ml/fixtures/eligibility-v2.json` (A2); `ml/corpus/**` (A3); `ml/pilot/**`, `docs/pilot/**` (A7); `ml/full_archive/**` (A8); `ml/probes/**` (coordinator).

## Evidence discipline

- Separate what you observed, what the source code shows, what you infer and what is untested. Never claim a typing benefit without a measurement.
- The Aalto 2,000-participant subset's test split is locked. Exploratory analysis uses train and validation participants only (`partition_participants` in `ml/pipeline.py`: rank by `sha256("{seed}:split:{pid}")`, 70/15/15, seed 42).
- Reproducibility: pin versions, fix seeds, record input hashes for every data-derived number.
- Keep evidence small. Commit one concise report (Markdown, at most about 200 lines) plus small machine-readable summaries. Do not commit raw logs, traces, participant-level data, participant IDs or large generated files. Bulky evidence goes in a gitignored `artifacts/` folder in your worktree; cite its paths in your report.
- Write plainly: short sentences, concrete numbers, no hype.

## Environment

- Node 24. In `typing-app/client`: `npm ci`, then `npm run check` (Node tests, typecheck, production build). Run it before finishing if you touched the client.
- Python runs in WSL (Python 3.14.4, matching CI). The pinned interpreter with numpy 2.5.3, scipy 1.18.1 and scikit-learn 1.9.1 is `/mnt/c/Users/Owenc/Documents/GitHub/TypeForge/.venv/bin/python`. Use it read-only and never install into it. For new packages create a venv inside your worktree (`wsl -e python3.14 -m venv .venv`, gitignored) and pin each new dependency.
- Existing Python tests, from the repo root: `python -m unittest discover -s ml/tests -v`.
- Aalto subset (read-only): `/mnt/c/Users/Owenc/Documents/GitHub/TypeForge/ml/data` (Windows `C:\Users\Owenc\Documents\GitHub\TypeForge\ml\data`). The pipeline writes into its data directory, so never point a writing command at this path; copy it into your worktree first.
- Browser checks: `typing-app/client/tests/browser/README.md`. A `playwright-core` build is at `C:\Users\Owenc\AppData\Local\npm-cache\_npx\9833c18b2d85bc59\node_modules\playwright-core` (`PLAYWRIGHT_MODULE=<that path>\index.mjs`). You may install Playwright browser binaries into the user cache; never add Playwright to `package.json`.
- Use only your assigned port, with `--strictPort`. Never stop a process you did not start. Hide background windows on Windows and stop your own servers when done.
- Other agents and projects share this machine (16 threads, 64 GB). Use at most 6 CPU-heavy processes or threads.

## Communication and finishing

- Ask the coordinator (`ask`) only for decisions your brief does not settle; keep working on independent parts while you wait.
- Do not start your own orchestration workflows (ralplan, ralph, team, ultrawork or similar), do not start Orca workers and do not open planning gates. Native read-only subagents for narrow help are fine.
- Finish with `worker_done` reporting: branch and final commit SHA; files changed; exact check commands with pass/fail counts; the report path; open risks; decisions the coordinator must make.
- A failing check is a finding to report, not to hide. If you cannot finish, report exactly what is done and what remains.
