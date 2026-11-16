# S2 minimal tooling repair

16 November 2026. Task `task_8666898d1822`, dispatch `ctx_e82887c464ea`, worker terminal `term_32a02c5e-422f-4b2b-93dc-3d1cf049133e`. Package commit: `695cbe57aa2fe1493429ddc1b469a3b48a06d874`.

## Result

Exactly pinned Vite 8.3.1 -> 8.3.3 and refreshed the existing PostCSS transitive source-map-js 1.2.1 -> 1.2.2. Full and omit-dev audits finish with zero vulnerabilities. No source, runtime dependency, override, PostCSS version, framework, global config, coordinator model, production deployment or remote Git state changed. This repairs development/build tooling advisories; it does not establish a shipped-browser exploit.

The package commit changes only package.json and package-lock.json: 9 insertions and 9 deletions. Three lock records change: root dev pin, Vite metadata, source-map-js metadata. Vite's registry-declared Rolldown dependency range changes from ~1.2.9 to ~1.2.11, as anticipated by S1; the already locked Rolldown **1.2.11 stays unchanged**. The repair script asserts every other dependency/engine/peer/bin field matches registry metadata and every unrelated lock record stays identical. No broad npm update/audit fix was used.

Fresh primary records in `primary-sources.json` include the seven advisory records, maintainer release records, and registry version metadata, with retrieval times/HTTP status. [Vite 8.3.3](https://github.com/vitejs/vite/releases/tag/v8.3.3) includes the editor, HTML normalization, Wasm and filesystem fixes; [source-map-js 1.2.2](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2) includes the indexed-map denial-of-service fix. The baseline full audit reports two high vulnerable packages; the final full and omit-dev audits report zero, with no new advisory requiring a wider patch. Network ECONNRESET failures are preserved in `audit-network-error.json` and `commands.json`; `audit-retry.json` and `audit.json` record the successful retry. Direct Node HTTPS fetch also initially failed; PowerShell HTTPS retrieved the primary records successfully. These transport failures are not vulnerability findings.

## Workspace provenance and ownership

The dispatch starts in `tf-tooling-patch`; the task explicitly requires an isolated Orca child. This worker created `tf-dependency-repair` using `orca worktree create --name tf-dependency-repair --parent-worktree active --json`, without --agent or a helper. Orca assigned branch `OwenC05/tf-dependency-repair`, instance `cba3521f-212d-452f-a568-c0d7e6dbe044`, parent `tf-tooling-patch` instance `5d9b3773-951d-4e62-b920-f6dc99a6f403`, and creator terminal matching this dispatch. `worktree-receipt.json` retains this provenance. No other writer or agent was launched in the child; all execution was by this worker using explicit child working directories. The original dispatch terminal identity remains the reporting identity.

Orca initially based the child on origin/main `de69444a6201da96281ca9ad88088904477775a2`; the clean new child was fast-forwarded to the dispatch workspace's exact HEAD `ad97218a87c41f015da1217f45b0907b8632b70a` before any edits. That is the source/build baseline. Parent workspace/source changes were not modified or reverted. This child belongs to this same Task/Dispatch; its creation is isolation, not a second assignment. Review/integrate the two child commits rather than assuming the package changes live in `tf-tooling-patch`.

## Validation

Node 24.21.0, npm 11.19.0, native Windows. `npm ci --ignore-scripts` and then a full clean `npm ci` both exit 0. `npm ls vite postcss source-map-js --json` exits 0 and establishes Vite 8.3.3 -> PostCSS 8.5.28 -> source-map-js 1.2.2, with no override. `npm run check` after the full clean install exits 0: **132 tests passed, 0 failed**, followed by TypeScript `tsc --noEmit` and the Vite 8.3.3 production build. See `check-final.txt` and the command receipts. No standalone lint script exists; no separate lint pass is claimed.

Built output contains **13 HTML entries**: index.html, practice.html, progress.html, results.html, lab.html, DetailedResults.html, LandingPage.html, LeaderBoard.html, ProgressDashboard.html, ResultsPage.html, SignIn.html, TypingDrill.html and TypingTest.html. The correspondence runner fetched **all 21 emitted files** from the strict loopback preview and compared their SHA-256s to disk, before and after browser verification: every file returned HTTP 200 with matching hashes. `build-correspondence.json` records the final per-file/source/package hashes. A bounded scan of emitted HTML/JS/CSS/maps found zero occurrences of /@vite/client, /@vite/env, /@react-refresh, __open-in-editor, vite-hmr, source-map-js and SourceMapConsumer. This is a specified-marker check, not an exhaustive security audit.

The existing release browser runner was copied into this evidence directory, changing only its strict base URL to **127.0.0.1:5316**, then correcting an asynchronous observation in that evidence copy. Chrome **157.0.8103.52** and Edge **157.0.4341.60** each passed **46 native-flow assertions + 15 focused checks = 61 checks**, with zero page errors. Flows include the default General/30s first key, middle selection/replacement/backspace, result/Again and keyboard focus, settings persistence/manual pair, save failure/recovery and existing legacy/failure paths. Every case uses fresh browser contexts; the runner closes its contexts and browsers.

The first focused pass immediately read manual-pair visibility after pressing Space and reported false in both products, while subsequent selection and persisted state succeeded. The original detailed initial report is preserved as `browser-first-probe.json`, with its exit receipt in `browser-first-run.json` and a compact observed-output recap in `browser-initial-summary.json`. The evidence runner now waits for that control to become visible (normal asynchronous UI settlement) before asserting it; the rerun passes both products without any application change. This is a harness timing correction, not an application fix or a hidden failed check.

The final browser report names package commit `695cbe57aa2fe1493429ddc1b469a3b48a06d874`; its package/source and asset hashes match the exact clean-install build served on 5316, and no rebuild occurred during browser checks. The original pre-commit build is byte-identical to the package commit's sources. The server was hidden Node PID **59372**, executable `C:\Program Files\nodejs\node.exe`, exact command and creation timestamp in `preview-process.json`. Cleanup rechecked executable, full command and creation time before stopping only that PID; port 5316 was no longer listening. Root 5301 and other processes were untouched.

## Hashes and boundaries

Raw SHA-256, baseline -> final:

- package.json: `B3F46B51308C64BEA4E9115B3B4AEF42C68C15B10E4654B079FC37B1E70BBD63` -> `38283CF58160D6B51C0258D70A1EC85B120100B04AA577927419B5FEC80555F1`.
- package-lock.json: `3873229AD4FAFAE6EB42CF997499780D3CB3ECF1A03A81E302F0D45C271310FA` -> `D9DE2E32CC69DFDAFA61B320B5DB0E272EA49B7F191E88ED8913306B9A230096`.

The lock file's working-tree newline conversion is captured by these raw hashes; Git's normalized blob is the review source. All application source files are unchanged from the baseline and independently hashed in build-correspondence.json. The evidence commit is intentionally separate from the package fix.

Both tested browser products use Chromium. No Firefox/WebKit, physical device/IME, screen-reader speech, wall-clock duration, visual acceptance or learning-efficacy claim is made. Screenshots are automated evidence only; actual Claude retains visual/UI ownership and existing accessibility findings. Independent root/reviewer inspection and integration remain outstanding; no push/deployment occurred. Requested model/effort stayed unchanged; this report does not infer backend identity from task text.
