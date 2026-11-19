# Direct practice integration

16 November 2026. The reviewed direct-practice iteration is integrated into `feature/daily-practice` at merge commit `3f9a98dbc5ba3e696b93fcf1c2af4062a83842a0`. The accepted implementation is `db56cf0fca6c54c02439dfd01624c5fc3692a56e`, final source `932f000a8636a411a250960e53f8ef2933ffc33d`. The merge preserves the worker history and completed foundation repairs. Portfolio and the original TypeForge checkout were not modified.

## Result

`/` opens focused, ready for 30-second General practice on a clean first visit. Typing starts the clock. Optional duration and practice settings remain available and are remembered. Results appear in place, with Again ready for keyboard continuation. The paper-and-ink interface, narrow layouts, context-line wrapping and failed-save recovery were implemented and visually reviewed by actual Claude agents. The native typing editor remains outside the SDK agent-write surface.

The review, ranked findings and staged roadmap remain the planning basis. This completes the direct-practice UI iteration and foundation repairs; it does not implement the later adaptive-policy, Undo or schema work, promote a model, or establish learning efficacy.

## Independent review

- Technical reports close ET-1/ET-2 and F1–F4 on the recorded source snapshots, with before/after regressions and actual-handler probes. See `review/fix-technical-review.md`.
- Actual Claude lead reviewed the complete journey in real time and identified L-1, unnecessary mid-word wrapping in noneditable context text. The bounded CSS repair is independently accepted at `db56cf0`; see `lead-review.md`, imported through root commit `ac3d541`.
- Final lead completion: `msg_9c7d3bc63d11`, Task `task_6815dfce6ce4`, Dispatch `ctx_fa2dac9b8663`, outcome succeeded. T4 follow-up completed as `msg_6b1d62744e7f`, Task `task_99e9239f71f9`, Dispatch `ctx_a83524e4db81`.

## Fresh root verification

1. `npm ci --no-fund`: exit 0, locked dependencies installed. It still reports two existing high-severity audit findings; no automatic dependency repair was applied.
2. `npm run check`: **132 passed, zero failed/skipped**, typecheck and production build passed. The repository has no configured lint or automatic browser-CI gate; those were not claimed.
3. `git diff --exit-code db56cf0 HEAD -- typing-app/client`: clean. The final source subtree is `344f0ee309e89975d62d7180df695a51cc3d3365`. `ml/` also has no integration delta.
4. Compared all 21 built assets/HTML files against the worker manifest. All eight assets (including JS and CSS) and eight HTML files match SHA-256 exactly. The remaining five entry HTML files differ only by carriage returns introduced in the Windows checkout/build; removing carriage returns gives exact content equality. No executable or markup difference was found. The initial exact-hash comparison therefore failed on those five files and was explicitly resolved, not reported as a universal byte match.
5. Fresh isolated-browser smoke on the integrated production preview: `/` remains `/`, title is `TypeForge — practice`, focus is `typing-input`, duration is `30`, kind is `general`, and there is no horizontal overflow at 1440×900. Native `a` key input starts the running state and retains the character. Zero page errors. The fresh browser context was closed afterwards.
6. The accepted worker's current-build receipts supply 33 context-wrap, 46 typing-flow, 74 recovery and 50 SDK-agent checks, geometry, 57 state captures and real 200% zoom. Root independently reran visual receipt integrity in the worker checkout: 55 files, zero errors. This validates artifact integrity, not taste. Browser scenarios were not redundantly repeated after an identical-source integration.

Older retry-race, late-history and timing receipts remain explicitly attributed to their earlier builds. The only subsequent product change is context-line CSS; the final app JS has the same bytes as the preceding reviewed build, despite a different Vite chunk filename.

## Local preview

At completion the integrated build is served at **http://127.0.0.1:5301/**. Root started the hidden process directly with Node and Vite, `preview --host 127.0.0.1 --port 5301 --strictPort`, from this workspace's `typing-app/client`. Verified listener/process: PID **48040**, exact command path under this workspace. HTTP `/` returns 200. The preview intentionally remains running for Owen; it is not a deployment. Revalidate PID, executable and command identity before any later process operation.

## Remaining limits

- The active editable passage may still wrap mid-word at narrow widths; the surrounding context now keeps whole words. Changing active wrapping failed native caret/selection geometry checks.
- Unsaved recovery is document-scoped memory: reload, tab close or BFCache restoration can lose it. Same-page repeat and settings retain ordered recovery, and in-app departure warns and offers export.
- At 200% zoom in a short window, restart and recovery controls require scrolling.
- Initial gzip transfer increased by about 33.5 KB; Select remains lazy. Timing is a bounded headless single-machine comparison.
- OS IME, screen readers/AT, Firefox/Safari, physical devices and human practice outcomes remain unverified. Historical Python environment gaps and the two dependency audit findings remain outside this iteration.
- Existing user changes in `skills-lock.json`, `.agents/skills/awwwards-inspiration/`, `.agents/skills/ui-taste/` and `.claude/` were preserved and not staged.

No push, deployment, account change, paid-credit purchase, response upload or model promotion occurred.
