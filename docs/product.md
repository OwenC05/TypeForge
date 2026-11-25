# TypeForge product notes

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

The build goes to `typing-app/client/dist`. Its relative links/assets support deployment beneath `/TypeForge/`. Serve it over HTTP so the compiled JavaScript loads. The former prototype URLs redirect to the working pages, including `DetailedResults.html?id=...`.

## Public demo deployment

Vercel builds the static demo when changes merge to `main` in `OwenC05/TypeForge`. It uses Node.js 24, runs `npm ci` and `npm run build` in `typing-app/client`, and publishes `dist`. The app uses ordinary multi-page `.html` routes. [Initial deployment and HTTPS checks](verification.md#public-static-demo-deployment)

## What works

- Practice opens ready to type. Choose General, Suggested or Pair and a duration of 15, 30, 60 or 120 seconds. Practice defaults to 30 seconds and assessment to 60. The app remembers their settings separately.
- The first accepted character starts the clock. Space after the last word advances the passage. Until then you can edit it. Accuracy includes corrected mistakes, and WPM counts correctly positioned characters, including those in the final partial passage.
- General uses the original 80 practice sentences. Assessments draw from 600 sentences. Pair mode draws from 406 sentences covering 100 letter pairs. A fresh retest excludes the originating assessment’s passages, including its final partial prompt. If the origin is missing or incompatible, the app explains why it starts a new assessment. [Sentence sources](../typing-app/client/src/generated/CORPUS-ATTRIBUTION.md)
- Completed runs save in this browser profile and can be reopened, exported or deleted. A failed save keeps the result available for export. Interrupted or unsupported runs stay out of headline trends. If a safety limit stops a run, its partial text and metrics are available in a diagnostic export.
- On a declared physical QWERTY keyboard, assessment results compare Ridge and historical-baseline predictions made before each sentence with the eligible timings that followed.

History belongs to this browser profile and site address. Clearing site data removes it. Export JSON to keep a copy. The app can finish and save a loaded session offline. Reloading requires a network connection.

## ML evidence and coaching

Suggested reads the latest 200 clean, submitted sentences from saved QWERTY assessments and General practice. Each timing is the interval between two lowercase letters in the same word. A mistake or edit excludes that sentence. Flagged runs and all drills are excluded, including earlier Suggested blocks. Existing eligible records count on the same terms as new typing.

L5 estimates how long each pair usually takes at your speed and how far your own timings differ. A practice pair needs at least two timings and a greater than 95% chance, under the model, that you take over 10% longer than expected to type it. If several pairs qualify, L5 picks the one estimated to cost the most time in ordinary text. Suggested draws from the same sentences as Pair mode for that pair, at your chosen duration. If evidence is thin, the fit is poor or QWERTY is undeclared, it runs General and explains why. A clean QWERTY General block can supply more evidence.

The fit check uses earlier typing to predict an 80% range for each pair’s mean timing in the next sentence. It pools the pair checks from the latest 20 checked sentences. Once eight sentences have been checked, coverage below 70% sends Suggested back to General. The Lab shows your estimated letter-pair speed, whether it falls in the training range, how many checks fell inside their ranges across how many sentences, and up to three of your largest pair gaps.

L5 learned from full-size and laptop QWERTY keyboards. Its supported speed range is about 32–150 WPM. Outside that range it uses the pair pattern at the nearest boundary and your own pace. The held-out test measured later pair timing. Whether practising a suggested pair helps on fresh text is the question for the planned trial. [Coach model card](../ml/README.md#l5-practice-coach)

## Code map

| Browser source in `typing-app/client/src/` | Responsibility |
| --- | --- |
| `engine.ts`, `app.ts` | Typing, scoring, input events and page views |
| `corpus.ts`, `corpus-v2.ts` | General, assessment and Pair sentences |
| `coach-model.ts`, `coach.ts` | L5 predictions, evidence selection and fit checks |
| `model.ts`, `profile.ts` | Ridge predictions, assessment comparisons and retest history |
| `storage.ts` | Result validation, IndexedDB upgrades and history reads |

## Verification

The IndexedDB upgrade from version 2 to 3 adds stores and leaves existing records in place. Earlier timed results and fixed-length Suggested blocks remain readable and exportable. See the dated checks for storage, native input and the production browser suites. [Verification record](verification.md) · [Browser runner](../typing-app/client/tests/browser/README.md)

## How this was built

Owen set the product priorities and decides when to ship. A coordinating agent split the work into worktrees. Codex workers implemented changes and ran regression tests. Claude shaped the design and reviewed the interface. Independent reviewers reproduced failures and checked the fixes. The plans, reviews and test receipts are archived on the local `archive/process-receipts-2026-11` branch.
