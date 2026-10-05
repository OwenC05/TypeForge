# Native typing-flow regression

Uses the existing Playwright MCP runner; adds no application dependency. From
`typing-app/client`, run `npm run build` and then
`npm run preview -- --port 5183 --strictPort`. Invoke
`browser_run_code_unsafe` with `filename` set to the absolute path of
`tests/browser/typing-flow.js`. The returned JSON reports browser version,
individual assertions, page errors and failure counts. Require `failed: 0`
and an empty `errors` array.

Every case uses an isolated browser context/IndexedDB database. The 600+1
character safety-stop case uses native keyboard events, not synthetic bulk
input. Deadlines use Playwright's accelerated clock. Transient storage failure
is injected only in the isolated context and its method patch is restored.

This is an explicitly invoked production-build browser check, **not** part of
`npm test` or automatic CI. It does not certify real screen readers, physical
OS IME, other browser engines, physical devices or browser UI zoom. Those
remain separate release gates.
