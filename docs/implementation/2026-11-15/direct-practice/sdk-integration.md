# ui-sdk integration (direct practice)

16 November 2026 · branch `OwenC05/tf-direct-practice`. Companion to `ui-sdk/feasibility.md` (the proof) and `evidence/report.md` (the receipts). Versions: `@ui-sdk/web` and `@ui-sdk/core` **0.1.0-beta.3**, exact pins, the only dependency exception in this change.

## What uses the SDK

| Control | SDK component | Loading | Notes |
| --- | --- | --- | --- |
| Duration 15/30/60/120 | `ui-segmented-control` | initial | `default-value` from the URL, else the remembered value, else 30 |
| Kind: general / pair / suggested | `ui-segmented-control` | initial | `suggested` is `disabled` until saved evidence supports it |
| qwerty declaration | `ui-switch` styled as a key | initial | the visible key is the switch; no separate checkbox |
| Pair list | `ui-select` | lazy (`import()` on first open) | the trigger shows the current pair before the module loads |
| why? panel, narrow-width menu | `ui-collapsible` | initial | panels are `keep-mounted` |

The rail is styled through the components' `data-slot` and state attributes in `style.css` (`@layer ui-sdk`); there is no SDK theme or `web.css`. Bundle cost against b898dc6: +18.9 KB gzip initial (define-element + env), the Select popup (31.1 KB) and sheet presentation (13.4 KB) only on first pair-list open (`evidence/bundle.json`).

## One app-owned settings state

Every rail control routes its cancelable `valuechange` through one guard (`app.ts`, settings rail). The guard refuses — `event.preventDefault()`, not `disabled` — while the page is closing, while a block is running, and for unsupported values, and announces the refusal with its source in `#settings-status` (for example "Agent change to duration refused: a block is running. Finish it or restart first."). An accepted change queues `changeSettings`, which restarts the block with the new settings (carrying any unsaved result, below) and remembers only duration, kind and pair. Refusing instead of disabling keeps focus and layout still during a run.

## Editor exception

The timed `#typing-input` is a native `textarea`, not an SDK text input, and has no SDK registration or agent tool. It owns keydown/beforeinput/input, selection, composition, integrity handling and engine measurement exactly as before the redesign. This is the authorised narrow exception from the feasibility note: a wrapped or agent-writable editor could fabricate typing evidence and would change the event path the engine measures. The agent test resolves neither the input's ID nor its label for `setValue`; settings writes produce zero editor events, never start a block and never insert text (`tests/browser/ui-sdk-agent.mjs`, 50/50 on the final build). This is separation of the exposed SDK capability, not a sandbox against arbitrary page script or automation.

## Agent contract (what `ok` means)

Production installs no agent. `createAgent` exists only on the test page used by `ui-sdk-agent.mjs`. On that page:

- **Bridge lock (default):** the bridge `allow` predicate refuses every settings step while a block runs; `agent.act` returns `ok: false`.
- **Bridge open (`?bridge=open`):** the step is dispatched to the component, whose change callback cancels it. ui-sdk documents this case (`docs/agents.md`, act result): `ok` means no bridge error, and a callback may cancel without failing the step. So `ok: true` here means **dispatched, not applied**. The truth is the step's `changes` (none for duration), the returned `values` (duration unchanged) and the app's status line (the agent-sourced refusal). Since 71201b7 the test asserts exactly those three, not "either outcome".

Native typing during the run is unaffected in both modes: one real key reaches the editor (keydown, beforeinput, input) and the saved result records one attempted character.

## Continuation policy for unsaved results (ET-1)

Not an SDK feature, but it shapes the rail's behaviour, so it is recorded here. When a setting change or Again starts the next block while the previous result's save is pending or failed, that result is adopted into a page-scoped, in-memory, ordered list (`src/unsaved.ts`); nothing waits on storage. The slot shows one line, "N results not saved", with retry save (sequential, oldest first, one write per entry at a time, stopping at a permanent validation refusal), export (all entries in one file) and discard. During a run the line is static and inert. In-app links are held once while anything is unsaved, with Export focused and "leave without saving"; returning to the passage cancels the hold. No new storage and no beforeunload: tab close, reload and BFCache restore lose the list (documented limitation). Browser evidence: `evidence/unsaved.json`, `evidence/retry-race.json`.
