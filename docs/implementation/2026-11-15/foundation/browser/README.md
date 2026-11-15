# Foundation browser replay

Source runner documentation: `typing-app/client/tests/browser/README.md` from the repository root. These are explicitly invoked Playwright MCP filename runners, not npm/CI tests.

1. In the isolated foundation workspace, run `npm run build` from `typing-app/client`.
2. Check that loopback port 5197 is unused, then start `npm run preview -- --port 5197 --strictPort` from that client directory with a hidden owned helper. Preserve PID, command and cwd; close only that helper when finished.
3. Invoke isolated Playwright MCP `browser_run_code_unsafe` with `filename` set to the absolute path of `typing-flow-5197.js` in this directory, then separately `restart-lineage.js` here.
4. Require nonzero assertion counts, `failed: 0` and `errors: []` in each result. A runner tool call returning normally is insufficient: the scripts return failures as JSON.

The flow copy differs from the source harness only by port 5183 becoming 5197. Recorded Chromium 157.0.8103.52 results: 39 flow checks and 64 lineage checks, no failures or page errors. Each case owns/closes an isolated context. The supplied MCP page/browser is not closed. The lineage fixture is synthetic and application-validated, covering assessment-from unchanged/restored, practice-from unchanged/deleted/restored, and retest unchanged/deleted/incompatible/restored. It does not prove real-bank passage exclusion or practice remaining incompatible. Saved rows and retained origin immutability are checked after native restart/input and accelerated completion.

Accelerated time is not real-clock timing certification. No OS IME, screen reader, physical device/keyboard, browser zoom, Firefox/Safari, scientific benefit or deployed-source identity claim follows. JSON output is a bounded local execution receipt, not authenticated invocation provenance. The preview's failed initial repository-root launch and successful client-directory launch are separately recorded; cleanup identifies the successful PID and zero remaining listeners.
