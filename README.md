# TypeForge

A small typing practice app for everyday typists. The first implementation milestone is a working guest experience: 60-second assessments and general practice, real results, fresh-passage retests, and local history.

## Run locally

Use Node.js 24 or newer.

```sh
cd typing-app/client
npm ci
npm run dev
```

Open the local URL printed by Vite. If its default port is occupied, use `npm run dev -- --port 5180`.

```sh
npm run check    # Node tests, TypeScript checking, production build
npm run preview  # serve the production build locally
```

The build goes to `typing-app/client/dist`. Its relative links/assets support deployment beneath `/TypeForge/`. Serve it over HTTP; opening the source HTML directly as a file does not compile TypeScript. The former prototype URLs redirect to the working pages, including `DetailedResults.html?id=...`.

## What works

- Copy one sentence at a time. The first character starts the clock; Enter submits a nonempty response. Normal cursor movement, Backspace, word deletion and selection replacement work.
- Corrected mistakes remain in attempt accuracy. WPM counts retained positional matches, including the final partial response. No-input accuracy is unavailable; all-wrong accuracy is zero.
- Completed runs save in IndexedDB and can be reopened, exported or deleted. Storage failure keeps the current result visible with export and retry controls.
- Interrupted and unsupported-input runs remain labelled in history but do not contribute to headline trends. Leaving or restarting an unfinished run discards it.
- A self-declared physical QWERTY keyboard enables observed letter-pair timing from complete, correct, unedited sentences. Timing is descriptive; there is no trained model or coaching claim in this milestone.
- Original content includes 80 practice and 40 assessment sentences. A retest excludes the previous assessment's passages. General-practice scores stay separate from assessment trends.

Results belong to this browser profile and origin. Changing the hostname or port creates a different local store. Clearing site data removes local history; export JSON to keep a copy. Accounts and cloud sync are still planned. The app can finish and save a loaded session without a network connection; offline reload is not supported.

## Code map

| File | Responsibility |
| --- | --- |
| `typing-app/client/src/engine.ts` | Pure clock-driven state, positional scoring, sentence eligibility and timing aggregates |
| `typing-app/client/src/app.ts` | Native input events, page views, charts and navigation |
| `typing-app/client/src/corpus.ts` | Versioned original sentence banks and selection |
| `typing-app/client/src/storage.ts` | Bounded result validation and direct IndexedDB transactions |
| `typing-app/client/tests` | Node's built-in tests; no test framework |

Vite and TypeScript are development dependencies. The browser bundle uses native DOM, CSS, SVG and IndexedDB APIs. There are no remote fonts, runtime CDN scripts, frontend framework or inference service.

## Verification

`npm run check` covers corrected and all-wrong input, middle insertion, range replacement, expiry/late submission, restart/abort, timing eligibility, delayed callbacks, corpus separation and corrupt saved data. CI runs the same command.

Browser acceptance was exercised in Chromium on 30 September 2026 using real keyboard events and Playwright's clock to advance the 60-second timer:

- A completed assessment navigates to its saved result and survives reload.
- A fresh retest excludes the initial passages; native middle insertion, selection replacement and restart work.
- Focus loss flags the run and excludes it from the assessment trend.
- Paste is blocked. Simulated IndexedDB failure preserves the visible result; JSON export and retry work after storage recovers.
- Deleting the saved test result removes its history entry.
- Desktop and narrow-screen pages have no page-level horizontal overflow; the history table scrolls within its container.

Recheck these flows in Firefox and Safari before public release. The automated browser clock verifies deadline behaviour without making claims about timing precision on every keyboard/browser. Inspect a normal 60-second run on the intended device as part of release QA.

## Next milestone

Before further implementation, see the [Monkeytype and keybr research](docs/research/typing-products.md) for observed strengths, trade-offs, screenshots and proposed changes to TypeForge's product direction.

Follow [PLAN.md](PLAN.md): build the reproducible public-data audit and baseline benchmark, then the trained candidate and browser prediction comparison. Targeted coaching, accounts/cloud sync, the consented pilot and deployment remain unfinished. No external accounts or services have been provisioned.
