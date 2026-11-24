A5 Make the work legible: archive process receipts, add a process page, one-screen README with fresh screenshots

Read `.omx/plans/model-coach-20261124/common.md` and `plan.md` first. You are worker A5. Port 5342.

## Why

The repository tracks about 2,240 process files (80 MB) under `docs/implementation/**` and `docs/reviews/**` against about 20 source files, and the README is a long wall of caveats. A reviewer should understand TypeForge in one screen and find the depth one click away.

## Steps

1. Archive. Create a local branch `archive/process-receipts-2026-11` at your worktree's starting commit. Do not push it. Then, on your worktree branch, remove `docs/implementation/**` and `docs/reviews/**`.
2. Process page `docs/process/README.md` (at most about 200 lines), written from the receipts before you delete them: how TypeForge was built with AI agents (Codex workers implementing and verifying, Claude for design and review, a coordinating agent, Owen deciding); the gate pattern (red/green tests, independent review, acceptance); counts computed from the receipts (runs, tasks, reviews, findings caught by independent review); three to five concrete examples of defects caught by review, each with its commit SHA; and an honest note on what was wasteful (for example, receipt volume). Link the archive branch as `https://github.com/OwenC05/TypeForge/tree/archive/process-receipts-2026-11` and say it is published only when Owen pushes it. Facts only; this page is portfolio evidence.
3. Move the long-form README content (What works, ML evidence, verification summary, release boundaries, compatibility notes) into `docs/product.md`, keeping its substance and fixing relative links. Keep `docs/verification.md`.
4. New `README.md`, about one screen: a two-sentence pitch; the live demo link (https://typeforge-alpha.vercel.app); one or two fresh screenshots; a short "How it works" Mermaid diagram (public data to Python pipeline to JSON artifact to browser inference, plus the local loop of typing, frozen predictions, observations and practice); the current headline numbers, dated and labelled as public-data timing prediction, not typing gains; status and next steps linking `docs/roadmap.md`; quick start; links to `docs/product.md`, `ml/README.md`, `docs/verification.md`, `docs/process/README.md`.
5. `docs/roadmap.md`: a public summary of `.omx/plans/model-coach-20261124/plan.md` (the problem, the model's new job, monitoring, the pilot, what is done and what is next). No internal worker or task names.
6. Screenshots: build the production app and serve it on port 5342 (`--strictPort`). Capture at 1440x900: the typing screen mid-run (real key presses, synthetic IndexedDB per `tests/browser/README.md`) and the ML Lab. Replace the 30 September images in `docs/screenshots/` (at most three images, each at most about 300 KB). The Claude coordinator judges the visual choices, so include the image paths in your report.
7. Fix every link that pointed into the removed folders (grep `README.md`, `PLAN.md`, `DESIGN.md`, `docs/**`, `ml/README.md`, `ml/VERIFICATION.md`; leave `.omx/**` alone). Add one status line at the top of `PLAN.md` pointing to `docs/roadmap.md`; no other PLAN.md edits.

## Owned paths

`README.md`, `docs/**` except `docs/pilot/**`, `PLAN.md` and `DESIGN.md` (link fixes and the status line only), `ml/README.md` and `ml/VERIFICATION.md` (link fixes only; another worker owns the rest of `ml/README.md`, so keep those edits to the minimum).

## Done when

The archive branch exists locally and contains every removed file (state the file count on both sides); no broken relative links remain (show the check you ran); the README renders as one screen; `worker_done` per common.md with the screenshot paths.
