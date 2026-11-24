# TypeForge product notes

These notes describe the September and October 2026 versions. [Current product overview](../README.md)

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

## Public demo deployment

Vercel serves the static demo from GitHub repository `OwenC05/TypeForge`, production branch `main`. Deployment settings: Node.js **24**, root directory `typing-app/client`, install command `npm ci`, build command `npm run build`, output directory `dist`. Keep the ordinary multi-page `.html` routes; no SPA catch-all rewrite is configured. The local setup/build commands above reproduce the static output.

See the [deployment evidence](verification.md#public-static-demo-deployment) for the deployed revision, CI result and HTTPS checks. Hosting the demo does not complete the accounts, transfer-study or full-release gates.

The rolling-flow changes described below are a **local implementation**, not a newly verified production deployment. The recorded public smoke test covers the 30 September revision.

## What works

- Type in one integrated native textarea over a feedback mirror, with previous/current/next passage context. Space after the final word advances automatically, even with mistakes; Enter does not advance. Cursor movement, Backspace, word deletion and selection replacement edit only the current passage. Committed passages cannot be edited.
- Choose 15/30/60/120 seconds before starting; 60 is the default. The first accepted text insertion starts the clock and locks the settings. URL `duration` values use seconds; unsupported values fall back visibly to 60. Restart retains the settings and starts a new run.
- Corrected mistakes remain in attempt accuracy. WPM counts retained positional matches, including the final partial response, over the selected duration. The terminal advancing space does not count; internal spaces do. No-input accuracy is unavailable; all-wrong accuracy is zero.
- Completed runs save in IndexedDB and can be reopened, exported or deleted. Storage failure keeps the current result visible with export and retry controls.
- Interrupted and unsupported-input runs remain labelled in history but do not contribute to headline trends. Leaving or restarting an unfinished run discards it.
- A self-declared physical QWERTY keyboard enables observed letter-pair timing from complete, correct, unedited sentences. Predictions freeze before each sentence. Results compare saved historical-baseline and experimental-candidate predictions with the same later eligible observations; missing or legacy predictions are labelled, never reconstructed.
- Original content includes 80 practice and 40 assessment sentences. The finite bank cycles during a timed run; rolling flow does not promise unique or unlimited content. A fresh retest excludes every originating assessment passage, including its final partial prompt, before cycling the remaining bank. A missing, deleted, incompatible or exhausted origin produces an explained new assessment instead.
- General, Recommended and Manual pair practice work from the Practice chooser, without requiring an assessment first. Manual offers within-word pairs supported by at least three practice passages and records your choice, not a diagnosed weakness. Practice never contributes to assessment calibration or headline trends.
- Saved results identify duration and Space flow versus Legacy Enter. Comparisons and calibration isolate duration, interaction mode, keyboard declaration, language, corpus and metric/schema versions. Existing 60-second Enter records remain readable and exportable unchanged; they do not seed new flow comparisons or retests.
- Exceptional safety limits stop the run with retained partial metrics/text and a diagnostic export, not a normal completed result or progress entry. Restart remains available.
- Safety-stop recovery preserves native keyboard navigation. A correction hint identifies the first wrong character without adding another input bar. Oversized completed-result data stops with an export-only diagnostic; permanent validation errors are not offered an impossible save retry.

Results belong to this browser profile and origin. Changing the hostname or port creates a different local store. Clearing site data removes local history; export JSON to keep a copy. Accounts and cloud sync are still planned. The app can finish and save a loaded session without a network connection; offline reload is not supported.

## ML evidence and coaching

The default coach is the validation-selected historical baseline, not the experimental candidate. Recommended practice needs compatible assessment history, at least eight pair observations, support in three practice-bank sentences and a positive score. Otherwise it explains why a recommendation is unavailable and offers General or Manual. Recommended and Manual drills share a two-target/one-general cadence.

Without the model artifact, Recommended remains unavailable: the existing scorer cannot identify a positive pair-specific focus. Warm compatible history can still provide baseline-only timing predictions; that is not a recommendation. General and Manual remain available, and manual choices never fabricate observation counts, scores or baseline evidence.

The browser uses a versioned JSON artifact with local linear inference. [ML documentation](../ml/README.md) covers source/license, exact acquisition and reproduction commands, participant/text holdouts, chronological history, baselines, uncertainty and limitations. The ML Lab reads the paired generated report; missing or mismatched evidence is explicitly unavailable. Real-data acquisition/training is separate from CI. Public-data accuracy does not prove TypeForge transfer or typing improvement.

```text
Public data → bounded Python acquisition / audit / holdouts → trained JSON artifact
                                                             ↓
Native typing → frozen browser predictions → later observations → local IndexedDB
                                                             ↓
                                    explained baseline focus → fresh retest
```

### Bundled experiment (30 September 2026)

The genuine Aalto acquisition contains **2,000 participants**; conservative eligibility retains **1,386 participants, 5,812 trials and 117,653 transitions**. Model `aalto-ridge-83f562c419d5` links to report `benchmark-92947653a001` in `typing-app/client/src/generated/`.

The preregistered primary held-out/warm/nonreserved-text slice has **151 participants and 9,595 transitions**. Participant-macro MAE is **61.30 ms** for Ridge versus **67.55 ms** for the frozen smoothed-pair baseline (k=1). The paired participant-bootstrap 95% interval for Ridge minus baseline is **−7.76 to −4.89 ms**. These are public-data timing prediction errors, not typing gains or proof of transfer to TypeForge. The historical baseline remains the coach; the candidate stays experimental. Inspect the report for secondary slices, exclusions and uncertainty limitations.

## Code map

| File | Responsibility |
| --- | --- |
| `typing-app/client/src/engine.ts` | Pure clock-driven state, positional scoring, sentence eligibility and timing aggregates |
| `typing-app/client/src/app.ts` | Native input events, page views, charts and navigation |
| `typing-app/client/src/corpus.ts` | Versioned original sentence banks and selection |
| `typing-app/client/src/model.ts`, `profile.ts` | Strict artifact inference, rolling history, baseline coaching and retest lineage |
| `ml/` | Offline acquisition, benchmark, trained export and synthetic parity fixtures |
| `typing-app/client/src/storage.ts` | Bounded result validation and direct IndexedDB transactions |
| `typing-app/client/tests` | Node's built-in tests; no test framework |

Vite and TypeScript are development dependencies. The browser bundle uses native DOM, CSS, SVG and IndexedDB APIs. There are no remote fonts, runtime CDN scripts, frontend framework or inference service.

## Verification

Fresh pre-push repair checks on **5 October** passed **97 client tests**, **21 offline Python tests**, TypeScript checking, production build and whitespace checks. Sixteen capacity tests cover the normal envelope and exceptional serialized-byte overflow. The three pre-push findings were repaired: stopped-state keyboard navigation, engine/storage byte-cap handling and visible legacy-link fallbacks. A committed [native browser regression](../typing-app/client/tests/browser/README.md) now makes the targeted production checks reproducible through the existing Playwright runner; it is explicitly invoked, not part of automatic CI. Independent post-repair review and browser results are recorded in the [verification record](verification.md#pre-push-repair-checks--5-october-2026).

Fresh resumed CLI checks on 4 October passed **88 named client tests**, TypeScript checking, production build and whitespace checks. Earlier integration runs reported eight file wrappers. Fourteen capacity tests include eight measured JSON fixtures at **95,621–545,079 bytes**, below the 1MiB limit. Scoped Chromium 155 QA passed **107 assertions** across original, repair and six post-guard production checks. The post-guard regression uses trusted browser-native automation with an accelerated clock, not hardware, real-clock or AT evidence. Independent code review is **APPROVE** and architecture **CLEAR**, not overall acceptance. No lint script is configured.

The unchanged bundled experiment has **21 offline Python tests** and parity fixtures covering all **682 features**, fitted Python versus browser predictions (relative tolerance **1e-6**), baseline predictions and synthetic history advancement. CI runs frontend checks and offline Python tests, not acquisition or training. The dated 30 September browser/review evidence does not certify the new flow revision.

See the [verification record](verification.md) for commands, dated coverage, artifact hashes and gaps. Keyboard/CSS-zoom/reduced-motion checks are scoped evidence, **not** an accessibility audit or browser-UI zoom proof. On 4 October the user explicitly approved finishing local implementation while retaining real screen-reader/platform checks as **release gates**. Manual screen-reader/AT, OS IME, Firefox/Safari, physical-device and actual browser-UI zoom verification remain untested; none is claimed as passed.

## Release boundaries and next milestones

The genuine model/report are bundled and Python/browser fixture parity is checked. Independent post-repair review on **5 October** returned code **APPROVE** and architecture **CLEAR** with zero unresolved findings; initial findings remain recorded. Status: **verified local implementation / RELEASE GATES PENDING**, under the user-approved local-completion boundary. Local verification and independent code/architecture reviews pass within their scope. Final workflow/native status is recorded separately in the ledger and goal snapshots; this documentation does not certify accessibility or deployment. Historical 30 September approval is separate. See [PLAN.md](../PLAN.md) for the roadmap and [DESIGN.md](../DESIGN.md) for the interface contract.

The static public demo is live on Vercel. Accounts/private cloud sync, an independently consented TypeForge transfer pilot, Firefox/Safari/physical-device QA and full public-release certification remain unfinished. No account or cloud-history backend has been provisioned. Public hosting does not establish typing gains, platform completeness or a hiring outcome. Follow the [product research](research/typing-products.md) when considering interaction changes.

Schema-v1 optional prediction/focus/lineage, `settings.inputMode: 'flow-v1'` and separate `manualDrill` metadata preserve old records in the new app. Absent inputMode means the original 60-second Enter contract. IndexedDB upgrades non-destructively to database version 2 for the compound completedAt/id history index, without rewriting records. An old database-v1 app cannot open this upgraded database and may reject extended records. Export before downgrading; schemaVersion and metricVersion remain 1. Corrupt records are skipped visibly, not used as evidence or silently cleared.

## How this was built

Owen set the product priorities and decided when to ship. A coordinating agent split the work into separate worktrees. Codex workers implemented changes and ran regression tests. Claude shaped the design and reviewed the working interface. Independent reviewers reproduced failures and checked the fixes before acceptance. The [archive of plans, reviews and test receipts](https://github.com/OwenC05/TypeForge/tree/archive/process-receipts-2026-11) is local until Owen pushes the branch.
