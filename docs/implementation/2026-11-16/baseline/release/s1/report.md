# S1 dependency audit applicability

16 November 2026. Source commit `c65460b91ab2b310cb51f2f8cd4247d6c9f7c482` (current checkout, newer than the brief's application baseline `b3fb14c`). Scope: evidence and repair proposal only. No packages, lockfiles, application files, servers, browsers, ports, installs, fixes or commits were changed/started by S1.

Worker task `task_734594b249ff`, dispatch `ctx_cd1bc65d8d69`, terminal `term_32192290-50cb-42fa-bea6-05d8c9997644`. **Observed launch argv:** `-m gpt-6.1-sol -c model_reasoning_effort=medium`, process 35072, Codex 0.169.0; see `worker-process.json`. These are process launch settings, not a claim of independent backend/provider attestation. Node **24.21.0**, npm **11.19.0**. No recursive helpers were used.

## Result and evidence

Fresh `npm audit --package-lock-only --json` in `typing-app/client` exited **1** at 14:06 UTC: **2 high, 0 critical/moderate/low/info**, total **2 vulnerable packages**. Those package entries contain **7 advisory records**: one high for source-map-js; six for Vite (one high and five moderate). Package severity aggregation explains why audit metadata says two high rather than seven findings. Exit 1 is the requested evidence, not a failed task.

Fresh `npm audit --package-lock-only --omit=dev --json` exited **0**, with **0 vulnerabilities**. This is registry/lock dependency classification, not an exploit test or a guarantee about every generated artifact. Audit metadata reports prod 3, dev 63, optional 47, total 65; these are npm's own overlapping categories, not counts to add together.

Evidence: `npm-audit.json`, `audit-run.json`, `npm-audit-omit-dev.json`, `audit-omit-dev-run.json`, corresponding stderr captures, `lock-paths.json`, `advisories.json` (GitHub advisory API), `primary-sources.json` (maintainer advisories/releases and npm version metadata). All online records include retrieval time and URL; all ten primary-source fetches returned HTTP 200. Node `v24.21.0`, npm `11.19.0`, Windows. `worker-process.json` observes PID 35072, `-m gpt-6.1-sol`, `model_reasoning_effort=medium`; this is process configuration evidence, not an inferred model identity from the plan. Task `task_734594b249ff`, dispatch `ctx_cd1bc65d8d69`, terminal `term_32192290-50cb-42fa-bea6-05d8c9997644`. No helpers.

## Exact dependency paths and shipped applicability

| Lock node | Installed lock version / path from root | Applicable surface |
|---|---|---|
| `node_modules/vite` | `typeforge -> vite@8.3.1` (direct dev dependency) | Node development server and build tooling; six advisories concern dev-server/editor behavior. |
| `node_modules/source-map-js` | `typeforge -> vite@8.3.1 -> postcss@8.5.28 -> source-map-js@1.2.1` (all dev nodes) | CSS/source-map processing in development/build tooling when consuming malicious indexed maps. |

The only runtime dependencies in `package.json` are `@ui-sdk/core` and `@ui-sdk/web`, both `0.1.0-beta.3`; neither has an audit finding. `src/app.ts` imports the UI SDK. Vite config imports Vite only for build configuration, defines relative asset base and HTML build inputs, and has no custom server/middleware configuration. No source import of Vite, PostCSS or source-map-js was identified. For the intended static production build, these seven advisories do not establish an exploitable shipped-browser path: the affected Node source-map consumer and dev-server/editor endpoints are tooling. This is source/lock inference, **not a new bundle inspection**; the parent owns builds and browser evidence. Hosting the dev server as production would change that conclusion. `vite preview` is distinct from the affected dev-server paths; no live preview security verification was performed.

## Advisory-by-advisory applicability

All six Vite advisories list this branch's affected range as `>=8.3.0 <=8.3.2`, first patched **8.3.3**. Vite bundles launch-editor internally: local `node_modules/vite/dist/node/chunks/node.js` identifies launch-editor **2.14.1** at line 14265, launch-editor-middleware **2.14.1** at 14365, and registers `/__open-in-editor` at 24891. The three launch-editor advisories are attached to the `vite` audit node even though there is no standalone launch-editor lock node. Updating or overriding a nonexistent standalone lock dependency would not repair Vite's bundled code.

| Primary advisory | Severity | Preconditions and relevance to this checkout |
|---|---|---|
| [source-map-js GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), [maintainer fix release](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2) | High | Indexed source maps with extreme section offsets can block synchronous processing. Affected `>=1.0.0 <1.2.2`; patched **1.2.2**. Tooling dependency present; no malicious map ingress or exploitable application path reproduced. Trusted local sources reduce exposure, but untrusted source maps/dependencies in a build could reach the consumer. |
| [launch-editor GHSA-698v-4r3x-3vcv](https://github.com/vitejs/launch-editor/security/advisories/GHSA-698v-4r3x-3vcv) | Moderate | Windows shell percent expansion through editor arguments. Advisory describes malicious filesystem entries plus environment/NTFS conditions; the separate existence-check bypass below removes the file-placement prerequisite in a combined attack. Windows matches this worker host; actual attacker control/editor reachability is untested. |
| [launch-editor GHSA-r825-w8mm-5pxw](https://github.com/vitejs/launch-editor/security/advisories/GHSA-r825-w8mm-5pxw) | High | For Vite, requires **WSL**, attacker-created flag-like path, and specified susceptible editors (Vim/MacVim/Emacs or suitably configured Notepad++). This native Windows execution does not satisfy the Vite WSL condition. Relevant if developers later run Vite in WSL. |
| [launch-editor GHSA-587h-7wmj-h5pm](https://github.com/vitejs/launch-editor/security/advisories/GHSA-587h-7wmj-h5pm) | Moderate | Windows crafted editor path bypasses file-existence validation, and can combine with percent expansion. Native Windows matches platform; no exploit attempted. These editor fixes are in launch-editor **2.14.2**, bundled by Vite **8.3.3**. |
| [Vite GHSA-9jrq-w75r-8gcw](https://github.com/vitejs/vite/security/advisories/GHSA-9jrq-w75r-8gcw) | Moderate | Custom middleware passes an unchanged browser URL to `transformIndexHtml`, inline module script, and sensitive state/actions. Maintainer excludes normal internal SPA/MPA calls. No custom middleware/transformIndexHtml use found in this application's config/source; current setup does not establish this path. |
| [Vite GHSA-rq7h-c2jc-7f22](https://github.com/vitejs/vite/security/advisories/GHSA-rq7h-c2jc-7f22) | Moderate | Non-Windows dev server, network exposure, imported root-relative path colliding with readable host path outside allow list, and no deny match. This native Windows host is excluded; dev script binds `127.0.0.1`. Future non-Windows/exposed development requires reassessment. |
| [Vite GHSA-vfpm-58rq-9qcg](https://github.com/vitejs/vite/security/advisories/GHSA-vfpm-58rq-9qcg) | Moderate | Node/Deno Wasm loader can disclose the first four bytes of a denied file through a parse error. Node matches this checkout. Loopback limits network reach; it does not remove the underlying faulty read path or prove safety against a local requester. Upstream impact wording mixes “one of” with exposure/sensitive-byte/runtime bullets, and its example uses localhost; do not treat loopback alone as complete mitigation. |

The maintainer [Vite 8.3.3 release](https://github.com/vitejs/vite/releases/tag/v8.3.3) corroborates all six fixes: launch-editor 2.14.2, HTML URL normalization, Wasm filesystem checks, and safe-module path storage. Applicability is a source/config and advisory analysis, not proof of successful exploitation or absence of other vulnerabilities.

## Smallest compatible repair proposal (not executed)

Owner: parent assigns a focused dependency repair lane owning only `typing-app/client/package.json` and `package-lock.json`, then parent integrates verification.

1. Change the exact dev pin `vite: 8.3.1` to **8.3.3** and regenerate its lock resolution in a controlled follow-up. Audit suggests **8.3.8**, but every reported Vite advisory and the maintainer release establish 8.3.3 as the minimum fixed patch on the existing minor branch. No major/minor migration is required for these findings. Registry metadata confirms 8.3.3 retains Node `^20.19.0 || >=22.12.0`, compatible with project Node `>=24`; its Rolldown range `~1.2.11` accepts already locked **1.2.11**.
2. Refresh only the PostCSS `source-map-js` transitive lock resolution from **1.2.1 to 1.2.2**. Existing PostCSS `^1.2.1` accepts this patch; no new runtime dependency, override, PostCSS upgrade or application change is indicated. Preserve unrelated locked resolutions. Updating Vite alone may retain the old compatible-but-vulnerable source-map-js node, so verify it explicitly.

Version metadata: [Vite 8.3.3](https://registry.npmjs.org/vite/8.3.3), [source-map-js 1.2.2](https://registry.npmjs.org/source-map-js/1.2.2). This proposes minimum compatibility from declared ranges; actual install/build compatibility awaits execution. Re-run audit when implementing: new advisories could require a later patch. Do not run blanket `npm audit fix` or `--force`.

Acceptance and verification for that follow-up:

- Review manifest/lock diff: only Vite patch and necessary package metadata plus source-map-js patch; investigate any wider churn before integrating.
- In an isolated authorized dependency workspace run clean `npm ci`, `npm ls vite postcss source-map-js`, full `npm audit --json` and `npm audit --omit=dev --json`; require both identified packages to resolve fixed and both audits to have zero reported vulnerabilities at verification time (or separately triage new findings).
- Run `npm run check` (existing Node tests, TypeScript, production build). Report actual counts rather than assuming the brief's 132 tests. The repository has no separate lint script; do not invent a lint pass.
- Parent owns a smoke check of all emitted HTML entrypoints, default General start/result/Again and existing native-input/settings cases on the repaired exact build. Confirm static output has no dev client/endpoints; do not mix browser/build ownership with S1.

## Integrity and limits

Before/after SHA-256 unchanged: package.json `B3F46B51308C64BEA4E9115B3B4AEF42C68C15B10E4654B079FC37B1E70BBD63`; package-lock.json `3873229AD4FAFAE6EB42CF997499780D3CB3ECF1A03A81E302F0D45C271310FA`. S1 writes only this directory and leaves parent evidence intact. No application tests were rerun because S1 made no application changes and owns no build/browser resources. The raw audit and primary-source responses are current snapshots, not durable claims about later registry state. No fix is applied; parent integration/commit and the proposed repair remain separate follow-up work.
