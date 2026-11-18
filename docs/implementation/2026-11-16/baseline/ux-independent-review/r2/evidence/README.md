# r2 delta evidence (independent actual-Claude review)

Everything here is produced by the reviewer against **simulated fixtures** in the author prototype. Nothing is a user observation, production acceptance, or evidence that practice helps. The original review and evidence (`05a6767`, root import `8337569`) are in `../../` and are unchanged.

## Source correspondence

| Input | Identity |
|---|---|
| Author prototype | `3ad71b6` (= root `ecf8d18`), `ux/prototype/` byte-identical in this worktree (`git diff 3ad71b6 HEAD -- ux/prototype` is empty) |
| Composed stylesheet | root `typing-app/client/src/style.css` blob `1b10cbea2453aad470ca5b4918b1f222309eda89` (accepted forced-colours block) |
| Author's stylesheet | blob `41426a7629fc0c395c5e1875435f3fc00b8d645c` (used only for the separately labelled replay) |
| Toolchain (composed) | Vite 8.3.3, `@ui-sdk/web` 0.1.0-beta.3, read-only from a root checkout `typing-app/client` whose `package-lock.json` blob is `151cf9b3…` (= `ecf8d18`); nothing installed |
| Toolchain (author replay) | Vite 8.3.1 from the author workspace's client folder, read-only |

`source-sha256.txt` lists the sha256 of every input file and of both build outputs.

**Composed build** (`../runner/vite.r2.config.mjs`, output in the session scratchpad): `index-BVoscodI.js` `705eb087…`, `index-BSuNlSNP.css` `daad75ed…` (baseline.css), `fixtures-BPASI-5n.css` `9718178b…` (production style chunk), `fixtures-b3dyuyh8.js` `d1a8dc13…`.

**Author replay** (scratch only, labelled separately): `index-BADpSMsf.js` `5f84f6c8…bfff`. This is the hash the author recorded, so the author's build reproduces. `index-BSuNlSNP.css` and `fixtures-*.js` are byte-identical to the composed build.

**Byte comparison** (`build-compare.json`): with chunk filenames normalised, `index.js`, `gallery.js` and `index.html` are identical across the two builds. The composed production-style chunk, minus its single `@media (forced-colors:active){…}` block (991 bytes), is byte-identical to the author's chunk. The only built difference is therefore the accepted forced-colours block. The filename differences come from Vite and the chunk hash, not from the UI.

## Scripts (run against `http://127.0.0.1:5318`, fresh headless Chrome context each)

- `scripts/delta.mjs` → `delta.json`. The reviewer's own expectations for slices 1, 2 and 4, covering: reason matrix (16 reasons × 3 coaching configs × press / why? / screen-reader / Progress), `complete-ready` with null, absent and P1 r2 `supported` reasons, P1 r2 `automaticCoaching: 'unavailable'`, Enter at 0 ms, during and after the save, failure then recovery, late failure and late success during an active run, interrupted retry, final-test failure then retry, summary states and no cached median, QWERTY declaration, lower bound, Progress, and the finite end. A failing check is evidence.
- `scripts/capture.mjs` → `captures.json`, `screenshots/`. The author's 38 states (imported read-only) at 1440×900, 390×844 and 320×640, plus 13 states in Chromium forced-colours emulation and 3 review states. It also measures progress shape in forced colours from pixels.

Reproduce: build/preview with the runner (`TF_REVIEW_NM_CLIENT`, `TF_REVIEW_OUT`, optional `TF_REVIEW_PORT`), then run `PLAYWRIGHT_MODULE=<file URL of playwright-core/index.mjs> node scripts/<name>.mjs`.

## Not covered here

The production engine, storage, bounded reads, P1 r2 projection and finite adapter, a reload losing a pending save (contract rule 4), real navigation guards (the prototype's `practise` link drops an unsaved final test; production has the ET-1 leaving guard), Windows High Contrast themes, screen readers, IME, other engines, physical devices and human comprehension.
