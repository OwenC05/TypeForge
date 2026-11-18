# Browser checks

Explicitly invoked production-build and dev-server browser checks. They are
**not** part of `npm test` or automatic CI and add no application dependency.
All of them use this task's strict loopback port **5324**, fresh isolated
browser contexts, and a UUID synthetic IndexedDB name: before any app code
runs, `indexedDB.open('typeforge')` is redirected to
`typeforge-ui-synthetic-<uuid>`, any other name and `deleteDatabase` are
refused, and each check verifies the interception before relying on storage.
Saved sources are read from C's `currentResults` store.

## Native typing flow (`typing-flow.js`)

A Playwright MCP `browser_run_code_unsafe` function. Either run `npm run build`
and `npm run preview -- --port 5324 --strictPort`, then invoke the MCP tool with
`filename` set to the absolute path of `tests/browser/typing-flow.js`; or run it
unchanged through `coach-app.mjs` (below) with `COACH_PHASE=typing-flow`, which
starts and stops its own hidden preview server. Require `failed: 0` and an
empty `errors` array.

The 600+1 character safety-stop case uses native keyboard events, not synthetic
bulk input. Deadlines use Playwright's accelerated clock. Transient storage
failure is injected only in the isolated context, after the load-time status
check has created the database, and its method patch is restored.

## Settings rail agent contract (`ui-sdk-agent.mjs`)

Starts its own hidden Vite dev server on `SDK_PORT` (default 5324,
`--strictPort`) and drives the test-only `ui-sdk-proof.html` page:

    PLAYWRIGHT_MODULE=<playwright-core/index.mjs> SDK_SCRATCHPAD=<dir> node tests/browser/ui-sdk-agent.mjs

## Baseline and Suggested (`coach-app.mjs`)

    npm run build
    PLAYWRIGHT_MODULE=<playwright-core/index.mjs> COACH_OUT=<evidence dir> COACH_PHASE=<phase> node tests/browser/coach-app.mjs

- `real`: the production build under its own hidden `vite preview`. Real key
  presses into the native textarea, with scripted intervals under a paused
  clock, drive real C storage, D policy and the E finite adapter. The flow runs
  ten baseline tests through to an admitted Suggested plan. It also covers
  failed saves and retry, reload, Progress, export, reset, cross-tab stale
  admission, the settings mismatch, a flagged finite end and stale evidence.
- `injected`: the Vite dev server. A test-side browser route rewrites the
  dev-served `coach-storage` module so `preparePractice` returns C's real status
  through a named patch (1 or 9 counted, proof pending, unreadable context,
  complete with coach pending). These checks are labelled `injected` and prove
  presentation, not lifecycle. The same phase also runs a `real-fault` case with
  real C over a failing `indexedDB.open`.
- `typing-flow`: runs `typing-flow.js` unchanged against the preview server.
- `fixtures` (dev server): real typing builds two saved-source sets in
  `<COACH_OUT>/fixtures/`. Set A is ten assessments with th slow, which admits
  th. Sets A and B together (B is ten General runs with in slow) admit in.
- `race` (dev server, needs `fixtures`): sources seeded through C's own
  `captureContext` + `saveSource`, never a status or admission override. It
  covers a reset through C or a focus invalidation followed by a native first
  key while the re-preparation is still queued under the paused clock. It also
  holds the `/src/finite-practice.ts` import (a browser route) across a reset
  and a newer generation in the settle and restart paths.
- `live` (dev server, needs `fixtures`): saves held at C's source hash. It
  covers Enter at 0 ms and 200 ms while a save is pending, a failure settling
  during the next block, a failed tenth save with retry, a focus change between
  two admitted pairs, and deletion through the results page's Delete control.
  These checks are labelled `real-seeded`.
- `fallback` (dev server, needs `fixtures/sources-a.json`): covers both General
  fallbacks, the settle step-back after a reset through C and the first key
  after a known invalidation. Prompt identity is read from three places: the
  passage the engine paints, the persisted record's sentence `promptId`s, and
  the stage metadata. It also checks that the first key lands exactly once.

Each phase writes `<phase>-flows.json` (every check, labelled `real`,
`real-fault` or `injected`), a helper receipt (PID, executable, arguments, port
closed after cleanup) and captures at 1440x900, 390x844 and 320x640 under
`screens/`. Every capture also asserts no horizontal overflow, no clipped slot
key and no `undefined`/`NaN`/`null` copy.

These checks do not certify real screen readers, physical OS IME, other browser
engines, physical devices or browser UI zoom. Those remain separate release
gates.
