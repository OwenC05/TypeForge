# P3 practice and results fixes

24 November 2026. Branch `OwenC05/tf-p3-fixes`. Final implementation and test revision `2d980fd67e0be20ae2e46e59dee61ecdf888a815`.

## First key during invalidation

The app installed General and then scored the pending native edit against its first sentence. Chromium reproduced this with a `w` typed for “we take the short path beside the river” while General opened on “the morning light falls across the kitchen table”.

The triggering edit now reveals General and clears the pending text and key timing. Focus stays in the native textarea. The next insertion starts the timer and scoring together. A plan whose import finishes in the meantime checks that Suggested is still selected before replacing the passage.

The browser test sends the app's focus invalidation during the native `beforeinput` event. General stayed idle during a two-second pause. Typing the displayed `t` then produced one saved attempt, 100% accuracy and zero first-attempt errors. A separate Node test holds the plan import across the fallback.

## Full result tags

General and timer-ended Suggested both save ordinary timed practice records. Their full results now say `PRACTICE`. Chromium also verified `MANUAL PAIR th`, `ASSESSMENT` and `RECOMMENDED PRACTICE` for a migrated result with explicit focus. Both neutral-tag cases checked the saved record for the absence of manual and recommended metadata.

| Regression | Red commit and observation | Green commit |
| --- | --- | --- |
| First native edit | `c4fad8e` recorded one unseen-prompt attempt in Node and one wrong character in Chromium | `40ae7fd` |
| Timed practice tag | `63a58e6` rendered `GENERAL PRACTICE` for both General and timer-ended Suggested | `1f36b7b` |
| Pending plan import | `6bdac1c` installed the delayed plan over General | `2d980fd` |

## Verification

Node 24.21.0 and headless Chrome 157.0.8103.80. Browser cases used isolated contexts, synthetic IndexedDB names, scripted clocks and a hidden strict-port preview on 5341.

| Check | Result |
| --- | --- |
| `npm run check` | 236/236 Node tests, TypeScript check and production build passed |
| `node tests/browser/p3-regressions.mjs` | 6/6 passed, zero page or console errors |
| `COACH_PHASE=typing-flow` | 46/46 native assertions, 49/49 including harness checks, zero page errors |
| `COACH_PHASE=real` | 120/120 passed, zero page or console errors |

Run from `typing-app/client` in PowerShell. The two existing runners hard-code port 5324. The scratch copies below change only that port to the worker's assigned 5341.

```powershell
$env:PLAYWRIGHT_MODULE = 'C:/Users/Owenc/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs'
$env:COACH_OUT = '.playwright-mcp/artifacts/p3'
npm ci --no-audit --no-fund
npm run check
node tests/browser/p3-regressions.mjs
$replay = New-Item -ItemType Directory -Force -Path "$env:COACH_OUT/replay"
foreach ($name in 'coach-app.mjs', 'typing-flow.js') {
  $sourceText = [IO.File]::ReadAllText((Resolve-Path -LiteralPath "tests/browser/$name"))
  [IO.File]::WriteAllText((Join-Path $replay.FullName $name), $sourceText.Replace('5324', '5341'))
}
foreach ($phase in 'typing-flow', 'real') {
  $env:COACH_PHASE = $phase
  node "$env:COACH_OUT/replay/coach-app.mjs"
  if ($LASTEXITCODE -ne 0) { throw "$phase failed" }
}
```

The coordinator's screenshots are in `.playwright-mcp/artifacts/p3/screens/` in this worktree under the names `suggested-before-key.png`, `general-after-invalidation.png` and `timer-ended-suggested-result.png`. The Chromium follow-up on port 5341 passed 5/5 fixture checks, 41/41 race checks, 21/21 fallback checks and 120/120 real checks. Its receipts are in `.playwright-mcp/artifacts/p3-followup/`.
