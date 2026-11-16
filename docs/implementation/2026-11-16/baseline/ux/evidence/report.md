# Prototype evidence: provenance, results and limits

All data are **simulated fixtures** (`prototype/fixtures.ts`). Nothing here is a user observation, a measured effect or evidence that practice helps.

## Source and build identity

- Branch `OwenC05/tf-baseline-ux`, based on `c65460b`. The prototype imports the production stylesheet read-only from `typing-app/client/src/style.css` at `c65460b` (sha256 `aea2a41c…5d8f4cbd`, before the separate F-1/F-2 forced-colours repair) and adds `prototype/baseline.css`.
- Controls are the shipped ui-sdk web components (`@ui-sdk/web` 0.1.0-beta.3 from the locked `npm ci` in `typing-app/client`): segmented control, switch, collapsible, and **progress** (newly used, no new dependency). The native textarea stays a plain textarea.
- Build: `vite build --config prototype/vite.config.mjs` (Vite 8.3.1 from the same lockfile), producing `dist/assets/index-4NBWDmGF.js` (sha256 `d5c7cd8f…`) and `index-DR9rR30X.css` (`cb054453…`). `dist/` is gitignored, so rebuild to reproduce. `tsc -p prototype/tsconfig.json` passes.
- Source sha256: `copy.ts d8465fcf…`, `fixtures.ts 9d44e38e…`, `proto.ts 2c161594…`, `baseline.css 3d425896…`.
- Served by `vite preview --host 127.0.0.1 --port 5312 --strictPort` (hidden background process, PID 59680, this lane's own). Root's 5301 was never touched.

## Browser runs

Headless system Chrome 157 via `playwright-core` 1.65.1, installed in this session's scratchpad (not a project dependency). Each run uses a fresh browser context; no persistent profile.

| Script | Result | Output |
|---|---|---|
| `scripts/capture.mjs` | 27 states × 3 viewports (1440×900, 390×844, 320×640) = **81 captures**. 0 page errors, 0 horizontal overflow, 0 clipped slot. | `states.json` (focus, label, active-line %, slot text, progress aria values, suggested-item ARIA per capture), `screenshots/`, `sha256.txt` |
| `scripts/keyboard.mjs` | **45/45 checks** (15 × 3 widths): first-key readiness; locked Suggested by arrow, Space and pointer; slot action; `why?` by Enter; test → result → Enter → next test → first key; focus-loss not counted; save-fail Tab order and retry; test 10 → try suggested → focused Suggested ready; test 10 insufficient → General primary; no key interception on the result; reset confirm safe-first → 0 of 10 | `keyboard.json` |

The flow checks K4, K5, K7 and K8 use `fast=1` (prototype clock 10× faster), labelled in each record. Typing is real key presses into the native textarea.

Reproduce:

```sh
cd docs/implementation/2026-11-16/baseline/ux/prototype
# node_modules here is a local junction to typing-app/client/node_modules (gitignored)
node ../../../../../../typing-app/client/node_modules/vite/bin/vite.js build --config vite.config.mjs
node ../../../../../../typing-app/client/node_modules/vite/bin/vite.js preview --config vite.config.mjs --host 127.0.0.1 --port 5312 --strictPort
cd ../evidence/scripts && PLAYWRIGHT_MODULE=<scratch>/node_modules/playwright-core/index.mjs node capture.mjs && node keyboard.mjs
```

Defects the runs found and fixed during the work: the ready hint leaked into the result slot; press copy overflowed the 320 slot; a 0-of-10 tally changed the first visit; the press-state capture lost focus before the SDK element upgraded; and the fixture label covered the primary key at 390. Each was fixed and fully recaptured.

## Limits

- This is a simulation of the UI contract, not the production engine, storage, bounded reads or P1 selector.
- One engine: headless Chrome only. No Firefox/Safari, device, OS IME, screen reader or human comprehension test.
- The tally-as-progress reading is a design judgment, not observed. See the independent critique.
- Forced-colours rules for the tally/progress are written but were not captured here. The production forced-colours repair has its own evidence (`../forced-colors-acceptance.md`).
