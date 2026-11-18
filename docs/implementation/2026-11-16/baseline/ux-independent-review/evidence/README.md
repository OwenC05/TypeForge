# Evidence for the independent review

All data are the prototype's simulated fixtures. See [../review.md](../review.md) for findings and limits.

| File | What it is |
|---|---|
| `captures.json`, `screenshots/` | 114 captures from `scripts/capture.mjs` (states from `scripts/states.mjs`) plus 3 r1 renders from `scripts/r1-deferred.mjs` (`r1-deferred.json`) |
| `flows.json` | `scripts/flows.mjs`: 7 keyboard/semantics flows × 3 viewports |
| `fast-enter.json` | `scripts/fast-enter.mjs`: Enter on *next test* before / after the simulated save |
| `scripts/forced-progress-colours.mjs` | computed progress colours, normal vs forced-colours emulation |
| `source-sha256.txt`, `sha256.txt` | hashes of reviewed prototype/style sources and of every screenshot |
| `receipt.json` | Orca launch/provider fields for this dispatch |

Reproduce: build and preview with `../runner/vite.review.config.mjs` (set `TF_REVIEW_NM_CLIENT` to a client folder whose `package-lock.json` matches, and `TF_REVIEW_OUT` to a scratch folder), then run each script with `PLAYWRIGHT_MODULE=<file URL of playwright-core/index.mjs>`.
