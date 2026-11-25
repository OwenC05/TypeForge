# Cross-browser verification

24 November 2026 · branch `OwenC05/tf-cross-browser` · production build of TypeForge.
The branch started at `38ef2e7` with the A4 fixes. The tested implementation is `39ed6d28ecb96a7ada6b2e230f87304cc62d442d`.

## Browser runs

Node 24.21.0 and Playwright Core `1.64.0-alpha-1790635538000`. Each run used a fresh browser profile, isolated synthetic IndexedDB storage and a Vite production preview on strict loopback port 5344.

| Browser and host | Native typing assertions | Typing flow including harness | Real coach | Original P3 cases | New regressions |
| --- | ---: | ---: | ---: | ---: | ---: |
| Chrome 157.0.8103.80 · Windows | 46/46 | 49/49 | 120/120 | 6/6 | 2/2 |
| Firefox 156.0 · r1553 · Ubuntu | 46/46 | 49/49 | 120/120 | 6/6 | 2/2 |
| WebKit 26.6 · r2368 · Ubuntu WPE | 46/46 | 49/49 | 120/120 | 6/6 | 2/2 |

Chrome ran with `BROWSER_ENGINE` unset and matched A4's three original counts. The final native flow recorded zero page errors. The real coach and P3 suites recorded zero page or console errors. The real coach run types ten assessments, admits a Suggested plan, finishes finite and timed blocks, retries failed saves, reloads, exports and resets. Its counts include layout checks. The two new cases run in the P3 file alongside the original six.

`npm run check` passed 236/236 Node tests, the TypeScript check and the Vite production build on both hosts. The Windows and Ubuntu builds produced the same main application asset, `app-aGdc7SBm.js`, with SHA-256 `bbe174d7deaf36902185b084d2cde194e5e79b49366124e4b7af57a2e082c01c`.

The first Firefox coach run passed 84 of 86 recorded checks before it stopped. After a flagged Suggested block, opening Suggested with `duration=60&qwerty=1` showed General without the “use 30 s” action. A diagnostic replay found 14 saved records and the expected action after navigation. Both that replay and a separate uninstrumented run passed 120/120. The cause of the first failure remains unconfirmed.

## Reproduced defects

1. **Baseline count disappeared if its progress widget could not load.** Open a full result immediately after saving while the lazy progress chunk is in flight. Firefox and WebKit intermittently reported a module import error on navigation. With an empty database and the widget module made to throw, the Progress page displayed a blank count. WebKit reproduced the blank value at `8ceaab2`. The app now writes the count as text and handles the optional import failure. The same case displayed `0 of 10 tests` at `3e6b75a`.
2. **Cancelling a finished IndexedDB read threw a page error.** WebKit reported `InvalidStateError` while exploring passage input. The regression dispatches a focus change during a real coach read's completion event, before its abort listener is detached. It reproduced the same error at `9e9f27d`. The listener now handles the already-finished transaction. The first letter started the block with no page error at `39ed6d2`.

## Input and layout

The additional probes passed 20/20 in Firefox and 20/20 in WebKit. Their two trusted transfer checks also passed in each engine.

- With `red bluex` in the textarea, Backspace left `red blue` and Ctrl+Backspace left `red `. Both engines sent trusted `beforeinput` events with `deleteContentBackward` and `deleteWordBackward`, respectively. After retyping `blue`, Home, End, Ctrl+Right and Shift+Right kept the native selection and painted caret aligned. Replacing the selected `ed` with `a` produced the saved response `ra blue`.
- In both engines, Ctrl+C/Ctrl+V from a sample textarea and a mouse drag from a text source delivered trusted `paste` and `drop` events containing the sample. TypeForge cancelled both events. The textarea stayed empty and the timer idle. These runs used a private headless clipboard.
- Tab away from a running block exposed the return button. Activating it returned focus to the textarea, and the saved result carried the interruption flag. Enter preserved a completed sentence. Space advanced it once. The 600th character remained editable. The 601st stopped the run with 600 characters retained and zero saves.
- A separate wall-clock probe withheld the app's 100 ms interval callbacks for over 15 real seconds. The first key after the deadline completed the 15-second result. Only the pre-deadline keystroke was scored. This exercises missed callbacks with the page in the foreground. OS background scheduling was outside the probe.
- At 1440×900 and 390×844, the editing caret stayed within the passage viewport. The screenshots show the passage, caret and Restart at both widths. The coach suite also checked horizontal overflow and clipped action keys at 320 px.

In this worktree, `typing-app/client/.playwright-mcp/artifacts/a9/final/<engine>/` holds the suite receipts, P3 output and input observations. The original failures are in `a9/linux/firefox/`, `a9/wpe/webkit/`, `a9/red-widget/` and `a9/red-idb/`. Editing screenshots are available for [Firefox at 1440 px](../../.playwright-mcp/artifacts/a9/final/firefox/screens/editing-1440.png), [Firefox at 390 px](../../.playwright-mcp/artifacts/a9/final/firefox/screens/editing-390.png), [WebKit at 1440 px](../../.playwright-mcp/artifacts/a9/final/webkit/screens/editing-1440.png) and [WebKit at 390 px](../../.playwright-mcp/artifacts/a9/final/webkit/screens/editing-390.png).

## Reproduction

From `typing-app/client`, use Node 24 and point `PLAYWRIGHT_MODULE` to the matching `playwright-core/index.mjs`. This run used the package in the npm cache under `_npx/9833c18b2d85bc59/node_modules/playwright-core`. Install the engine binaries using that package's `cli.js install firefox webkit`. Run each server-owning command in sequence.

```powershell
npm ci --no-audit --no-fund
npm run check
$env:PLAYWRIGHT_MODULE = Join-Path $env:LOCALAPPDATA 'npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs'
$env:BROWSER_PORT = '5344'
foreach ($engine in 'chromium','firefox','webkit') {
  $env:BROWSER_ENGINE = $engine
  $env:COACH_OUT = ".playwright-mcp/artifacts/a9/final/$engine"
  foreach ($phase in 'typing-flow','real') {
    $env:COACH_PHASE = $phase
    node tests/browser/coach-app.mjs
    if ($LASTEXITCODE -ne 0) { throw "$engine $phase failed" }
  }
  node tests/browser/p3-regressions.mjs
  if ($LASTEXITCODE -ne 0) { throw "$engine P3 failed" }
}
```

The Ubuntu replay used the same Node entry points. The local `.playwright-mcp/artifacts/a9/final-linux.sh` records the commands. For WPE, the local launcher verified that the loader could open the private GLES and x264 libraries, then skipped Playwright's system-library inventory for that process. The matching WPE browser binaries came from the default user cache.

## Platform limits

Both matching Windows browser builds installed in the default user cache. Windows Application Control blocked Firefox's `lgpllibs.dll` and WebKit's `libGLESv2.dll` before either could start (Code Integrity event 3077). The Firefox and WebKit results use their matching Linux builds in Ubuntu 26.04 under WSL2. Those runs loaded Ubuntu runtime libraries from a private directory.

Playwright WebKit on Windows or Linux uses a different browser shell from Safari. Real Safari, iOS, physical mobile keyboards, screen readers, OS IMEs and native Firefox/WebKit execution on this Windows host remain unverified.
