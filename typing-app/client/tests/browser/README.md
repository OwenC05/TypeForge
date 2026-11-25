# Browser checks

Explicitly invoked production-build and dev-server browser checks. They are
**not** part of `npm test` or automatic CI and add no application dependency.
The coach and typing-flow runner defaults to strict loopback port **5324**.
The P3 runner defaults to **5341**. Set `BROWSER_PORT` to run either on an
assigned port. Both accept `BROWSER_ENGINE=chromium|firefox|webkit` and
default to Chromium with the installed Chrome on Windows. For Firefox and
WebKit, install the corresponding binaries with the CLI from the same
`playwright-core` package as `PLAYWRIGHT_MODULE`. Give each engine its own
`COACH_OUT` directory for screenshots and receipts.

The checks use fresh isolated browser contexts and a UUID synthetic IndexedDB
name. Before any app code
runs, `indexedDB.open('typeforge')` is redirected to
`typeforge-ui-synthetic-<uuid>`, any other name and `deleteDatabase` are
refused, and each check verifies the interception before relying on storage.
Saved sources are read from the `currentResults` store.

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

## Suggested practice (`coach-app.mjs`)

    npm run build
    PLAYWRIGHT_MODULE=<playwright-core/index.mjs> COACH_OUT=<evidence dir> COACH_PHASE=real node tests/browser/coach-app.mjs

The real phase types General, Suggested and manual Pair blocks into the production app.
It checks the QWERTY declaration, abstention, an issued pair and its reason, extrapolation,
the Lab readout, drill exclusion, poor-fit fallback and reload. It captures these states
at 1440, 390 and 320 pixels under `<COACH_OUT>/screens/`. Each phase writes its checks
and server cleanup receipt to `COACH_OUT`. Use `COACH_PHASE=typing-flow` for the native
typing suite or run `node tests/browser/p3-regressions.mjs` for the saved-history and input regressions.

These checks do not certify real screen readers, physical OS IME, other browser
engines, physical devices or browser UI zoom. Those remain separate release
gates.
