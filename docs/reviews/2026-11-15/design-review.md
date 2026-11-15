# TypeForge design / UX review — 15 November 2026

Lane: design / UI / UX (Claude). This is an independent first-round critique. I did not read the other lanes' reports.

## 1. Scope, receipt and runtime

| Item | Value |
|---|---|
| Repository state | branch `feature/daily-practice`, HEAD `de69444a6201da96281ca9ad88088904477775a2`, clean worktree (`git status` showed only this new `docs/reviews/` folder) |
| App under test | **Local** Vite dev server `http://127.0.0.1:5187` (Vite 8.3.1, `--strictPort`, hidden process PID 25688), Node v24.21.0 |
| Browser | Google Chrome 157.0.8103.52, headless, driven by `playwright-core@1.56.1`. The helper was installed only in the session scratchpad, so the project's dependencies and lockfiles are unchanged. Each journey used its own isolated persistent profile (desktop, probes, mobile, stress, Monkeytype, deployed). |
| Viewports | Desktop 1440×900 (DPR 1). Mobile 390×844 (`isMobile`, `hasTouch`, DPR 2). Stress checks at 320×640 and 720×450 (DPR 2). 720×450 is a CSS-viewport approximation of a 1440×900 window at 200% zoom, not real browser-UI zoom. |
| Competitor | Live https://monkeytype.com, footer **v26.43.0** (observed 2026-11-15 15:05–15:11 UTC). Source: `monkeytypegame/monkeytype` master at `3aa6c2e448d3d13084daac678070ca9734b77ba1` (2026-11-14). Latest release tag `v26.43.0` (2026-10-20). |
| Deployed TypeForge | https://typeforge-alpha.vercel.app was inspected read-only (bundle `app-DRnCp6G3.js`). I found **no version evidence that ties it to `de69444`**, so none of my findings depend on it. Screenshots `dep01`/`dep02` are for reference only. |
| Provider / model receipt | Requested by `.omx/reviews/typeforge-20261115/design-launch.json`: agent `claude`, model `claude-opus-5-5`, effort `high`. Actual: Anthropic Claude, model `claude-opus-5-5`, as stated by this session's system context. **Effort as actually applied: unknown.** I cannot see argv or dispatch proof of it from inside the session. |
| Harness | Scripts are copied to `design-evidence/harness/`, with raw step logs in `design-evidence/*-log.json`. |

**How the typed data was produced.** Every saved result came from Playwright `keyboard.type` / `keyboard.press` events in isolated profiles, with scripted cadences between 25 and 110 ms per character. None of it was seeded or fabricated. These WPM figures measure the script's cadence, not a human typist. For example, the 325.5 WPM in `p05` comes from the 25 ms cadence. They must not be quoted as user performance.

**Journeys exercised (observed).**
- First visit → Just practise → 15 s General practice with a deliberate error, Backspace and Enter → result (15.2 s run, 2 passages submitted).
- 15 s QWERTY-declared assessment → result → primary next action → Progress → ML Lab.
- Returning visit in the same profile: home → practice defaults → 15 s practice → result → Keep practising.
- Focused-input probes: Shift+Arrow selection, extra wrong letters, Ctrl+Backspace, Enter, Escape, Tab mid-run, Tab+Enter, window blur, four-passage scroll.
- Mobile 390: home → practice → 15 s run (simulated key events) → result → progress → lab.
- 320 px and the 200% approximation: Manual-pair practice page and home.
- Monkeytype desktop: first visit → first keypress → Tab+Enter → choose 15 → 15 s test → result → reload (returning). Monkeytype mobile: landing only.

## 2. What the app is today, in one paragraph (observed)

TypeForge is a calm, dark, single-column typing tool with four top-level destinations: Assessment, Practice, Your progress and ML Lab. Home is a static marketing hero. Practice and Assessment share one page. It has settings at the top (duration, a QWERTY checkbox and the practice kind), then a framed typing panel with a large timer, live WPM and accuracy, a three-line rolling passage view (previous, current, next), long instruction text and several status paragraphs. A run ends by navigating to a long results page. That page shows four metric cards, a "Your next session" coach card, a prediction-comparison panel, a pace chart, key errors, pair timing and five buttons. Progress shows only an assessment trend and a table. Nothing on Home, Practice or Progress changes for a returning user, beyond the history table. The interaction core is careful and honest. The *product loop* around it reads like an instrument for running an assessment protocol rather than a place to practise every day.

## 3. Strongest existing qualities (observed unless noted)

1. **Honest, specific copy and empty states.** Nothing is faked. Recommended stays disabled with a reason ("No pair has eight observations, three supporting practice passages and a positive baseline score.", `d16`). Results say that predictions "do not select your practice focus". The tone matches `DESIGN.md`'s "quiet, precise, encouraging". This is a real differentiator worth keeping.
2. **Native editing works well.** Shift+Arrow selection is mirrored as a teal highlight (`p02`). Ctrl+Backspace deletes a word (log: `"we have bookxyz"` → `"we have "`). The caret is visible when focused (`p01`) and paste/drop are blocked with a message (source, `app.ts:402`). These come from the textarea-plus-mirror architecture (`app.ts:191-196`, `style.css:131-140`).
3. **Readable type and strong core contrast.** Measured against surface `#0a131f`: untyped text `#b1c0d1` 10.06:1, typed-correct teal 12.44:1, wrong `#ffaea4` 10.52:1. Muted `#a0afc1` on panel is 7.76:1. Context lines `#677b91` are 4.28:1 at 24 px, which passes AA for large text. Errors use a wavy underline and a tint as well as colour (`p03`, `style.css:75`).
4. **Visible keyboard focus.** A 3 px teal ring with offset (`d03`, `style.css:19`), plus a skip link and labelled controls (`aria-practice.yml`).
5. **Rolling flow keeps the active line in view.** After four passages the cursor sat at y=623 inside a 544–789 viewport (`p05`). Space advances the passage, and Enter is a guarded no-op with an explanation.
6. **No layout breakage.** No horizontal overflow at 390, 320 or 720 px (scrollWidth equals clientWidth, `mobile-stress-log.json`). No page errors in any run.
7. **Local-first and private.** There are no accounts, banners, ads or consent wall, and results are saved locally with no sign-in. Monkeytype, observed the same day, shows a third-party consent dialog on first visit (`mt01`), a merch banner and an ad slot on results (`mt06`), and "Sign in to save your result". For a daily-practice product, TypeForge's calm is a real asset.
8. **Reduced motion is effectively satisfied.** `document.getAnimations()` returned 0 with `prefers-reduced-motion: reduce`. There is no smooth scrolling and no animated caret, so nothing needs disabling.

## 4. Findings register (ranked)

Severity reflects impact on the stated goal: an enjoyable daily practice that is comparable to or better than Monkeytype in the relevant journeys. Evidence types: **O** = observed runtime, **S** = source, **I** = inference, **H** = hypothesis.

### F1 — High. There is no direct way into typing: no autofocus, a one-line click target and 10 Tabs. Evidence O+S, confidence high.
- **Observed.** After "Just practise", the practice page loads with `document.activeElement = body`. Pressing a key does nothing (log: `typed "a" without explicit focus` → value `""`). The same happens after the results page's "Keep practising" and after the coach CTA (`d16`; log `after Keep practising` → active `body`). Clicking the blank lower part of the large framed typing surface does **not** focus the input (log `click lower blank area of surface` → `body`). Only the 44 px-tall active line inside the 245 px surface is clickable (geometry log: surface 1022×245, textarea 988×44). Keyboard-only users need **8 Tabs + Enter** on Home and then **10 Tabs** on the practice page (Skip link → brand → 4 nav links → Duration → QWERTY → Practice → textarea).
- **Source.** The initial `practice()` path never calls `input.focus()`. Only the restart path does (`app.ts:498` vs `app.ts:500-505`). The textarea is `position:absolute; inset:0` inside `.active-passage` only (`style.css:130,135`).
- **Monkeytype, observed.** The first keypress after load focuses the test input (`active: textarea#wordsInput`, `mt03`). When the input is unfocused it shows "Click here or press any key to focus" over the words (`mt09`).
- **Impact.** Every session starts with a hunt for the input. It is the opposite of "just you and the keys".
- **Recommendation.** Autofocus the input on every typing-page load and after every next-action. Make the whole surface a click target, and treat any printable key pressed while unfocused as "focus and start". Show an explicit, visible "Click or press any key to start" state when the input is unfocused.
- **Acceptance.** From a fresh load of `practice.html` and of every results CTA, the first printable keystroke is accepted with 0 clicks and 0 Tabs. A click anywhere inside the typing surface focuses the input. An unfocused state is visibly labelled.

### F2 — High. Results → next practice is broken for practice-first users, and the coach copy is wrong. Evidence O+S, confidence high.
- **Observed.** A first-time user who chose "Just practise" finishes and is told: **"Set a new assessment baseline. Fresh comparison unavailable: The original assessment is unavailable or was deleted."** The primary teal CTA is "Take a new assessment" (`d10`, `m07`). Nothing was deleted; the user never took an assessment. On the returning visit, after an assessment *had* been saved, the practice result still showed the same message (log `returning results`). "Keep practising" is a secondary button at the very bottom of a roughly 1,800 px page, below the prediction, pace, key-error and pair-timing panels (`d11`).
- **Source.** The practice branch of the coach always resolves a retest against `origin`, which is null without a `from` parameter. It then shows `resolveRetest`'s reason verbatim (`app.ts:567-571`, `profile.ts:112`).
- **Monkeytype, observed.** Results fit in one viewport, with a "next test" button directly under the stats and a "tab > enter – restart test" key tip (`mt06`).
- **Impact.** It breaks the habit loop at exactly the moment a user decides whether to go again. The "was deleted" wording also suggests data loss.
- **Recommendation.** After practice, make the primary action **"Again"**: same settings, autofocused, triggered by Enter or Tab+Enter. Offer "Change practice" and, only when it is meaningful, "Check progress with an assessment" as secondary actions. Rewrite the no-origin copy to describe the state, not a failure.
- **Acceptance.** After any practice result, the primary action repeats practice with identical settings and is reachable by one documented key chord. The words "deleted" and "unavailable" never appear unless a record really was deleted or is unreadable. Primary next action plus headline metrics are fully visible at 1440×900 without scrolling.

### F3 — High. Nothing is remembered, and there is no daily action for a returning user. Evidence O+S, confidence high.
- **Observed.** On a returning visit in the same profile, Home is identical (`r01` vs `d01`). Practice resets to 60 s, QWERTY unchecked and General (log `returning practice defaults`), even though the previous runs were 15 s and QWERTY-declared. Choosing 15 s is required again on every visit. Monkeytype on reload kept **15** selected and focused the input (`mt08`, log `mt returning`).
- **Source.** Settings come only from URL parameters, with a default of 60000 ms and `qwerty=false` (`app.ts:13,162-165`). The client source has no `localStorage` or other preference store (grep found none). `home()` is static (`app.ts:104-121`).
- **Impact.** The returning-user journey, the core of daily practice, costs at least 3 interactions (nav, duration, focus click) before the first keystroke. There is no "today" anchor: no last session, no suggested next block, no time practised.
- **Recommendation.** Persist duration, keyboard declaration and last practice kind or pair locally, with an explicit reset. Give returning users a "Today" home, or land them straight on a ready typing surface. Show one clear daily action, such as "Continue: 3 × 30 s · last time 92 WPM / 99%", plus a modest summary of today's practice.
- **Acceptance.** With saved preferences, opening the app and pressing a key starts the remembered configuration with 0 extra interactions. Home differs for users with at least one saved session and shows exactly one primary daily action. Preferences survive reload, are user-resettable, and stay local.

### F4 — High (mobile and zoom). The typing surface starts below the fold, and passages wrap mid-word. Evidence O (+I for the on-screen keyboard), confidence high for geometry.
- **Observed geometry, top of the typing surface vs viewport height:**

  | Viewport | Surface top | Viewport height | Surface position |
  |---|---|---|---|
  | 390×844 | 625 px | 844 px | lower 26% of the screen |
  | 320×640 | 721 px | 640 px | entirely off-screen |
  | 720×450 (200% approx.) | 556 px | 450 px | entirely off-screen |
  | 1440×900 | 544 px | 900 px | starts past mid-screen |

  The run did not scroll the surface into view; `scrollY` stayed 0 during the mobile run (`m05`).
- **Mid-word wrapping.** Passages wrap inside words: "daylight th / rough" (`m05`), "en / ough", "a / nother", "th / e" (`s-320-practice-full`). The cause is `word-break: break-all` on the prompt, the textarea and the context lines (`style.css:132`).
- **Inference, not tested.** A physical-phone on-screen keyboard would cover roughly the lower 40–50% of the screen, so the typing line could be hidden unless the browser scrolls it. This needs physical-device and IME testing; simulated viewports are not that evidence.
- **Impact.** Mid-word breaks damage reading-ahead, which is central to fluent copying. On phones and at high zoom, the user cannot see what they are typing without manual scrolling.
- **Recommendation.** Use a compact typing-first layout. Collapse settings into a one-line summary chip ("15 s · General · QWERTY ✓ · change"), put the typing surface near the top, and scroll the active line into view on focus. Break only at spaces, keeping `overflow-wrap:anywhere` as a fallback for single over-long tokens. Decide explicitly whether touch devices are supported (see decisions).
- **Acceptance.** At 1440×900 and 390×844 the active line's top is at or above 45% of viewport height when the page loads. At 320 px and at 200% zoom the active line is visible after focus without manual scrolling. No corpus word shorter than the line width breaks mid-word at widths of 320 px and up.

### F5 — Medium-High. Active-typing hierarchy is crowded, and run-critical feedback appears off-screen. Evidence O, confidence high.
- **Observed: chrome during a run.** While typing, the page still shows the nav, the H1 and eyebrow, three settings rows (dimmed), a 13 px instruction sentence, "Timing predictions require…", "General practice · no supported targeted focus…", "Ready…" and a footer note (`d09`).
- **Observed: off-screen warnings.** The Enter-key warning renders at y=976 in a 900 px viewport (log `enter warning geometry`, `inViewport:false`), and so does the interruption warning (`p04`). A user who presses Enter or Tab sees nothing change near the text (`d08`).
- **Observed: help text moves.** The correction hint is appended to the instruction sentence and rewraps it from one line to two (`d07` vs `d09`), so text jumps under the typing surface.
- **Monkeytype, observed.** During a run every control fades. Only a small timer and the words remain (`mt05`), and live speed and accuracy are off by default (`liveSpeedStyle: "off"`, `liveAccStyle: "off"`, `timerStyle: "mini"` in `frontend/src/ts/constants/default-config.ts` at `3aa6c2e`).
- **Source.** The status and warning paragraphs come after the surface and restart button (`app.ts:197-200`). Instruction and correction copy share `#typing-help` (`app.ts:14-22,251`).
- **Recommendation.** Add a run state that hides or fades settings, nav, headings and explanatory paragraphs once typing starts, and restores them on finish or Escape. Place transient feedback (Enter no-op, focus lost, paused) directly adjacent to the active line, above the fold. Show teaching copy once, before the first run, not permanently. Make live WPM/accuracy a remembered preference (the default is a decision for Owen).
- **Acceptance.** During a run at 1440×900, the visible interactive elements are the typing surface and at most one restart affordance. Any warning raised during a run is fully inside the viewport and within 120 px of the active line. The help region does not change height while the user types.

### F6 — Medium. Error feedback can hide what was expected. Evidence O+S, confidence high.
- **Observed.** Typing extra letters into a word replaces the expected letters on screen. With the target "booked a table" and input "bookxyz", the mirror shows **"bookxyza table"**. The expected "ed " disappears, and the only explanation is the 13 px sentence below: "Correction at character 13: expected "e"." (`p03`). A single substitution likewise shows the typed "q", not the expected "e" (`d07`).
- **Source.** The mirror is built as `snapshot.value + prompt.slice(value.length)` (`app.ts:256`). The design favours exact geometry with the native textarea, which is a deliberate choice in `DESIGN.md`, but it trades away legibility of the target.
- **Recommendation.** Keep the native editing model, but render the target text as the stable layer. Show mistakes as a mark on the expected glyph, and show extra characters inline in a distinct "extra" style that never overwrites target glyphs. Move "expected X" next to the caret, or drop it once the visual makes it obvious. Character-position scoring can stay unchanged, because this is a rendering decision. Verify that geometry parity tests still hold.
- **Acceptance.** For any input, every target character remains visible in the mirror. Wrong and extra input is distinguishable by more than colour. There is no layout shift while correcting.

### F7 — Medium. Shortcuts are undocumented, and an accidental Tab or blur silently degrades the run. Evidence O+S, confidence high.
- **Observed.** Escape does nothing. Tab mid-run moves focus to Restart and marks the run as **interrupted**, so it will be "excluded from headline progress", while the timer keeps running (log `tab during run`). The warning appears off-screen. Tab followed by Enter does restart, so a Monkeytype habit accidentally works, but nothing tells the user. Window blur also flags the run (log `window blur`).
- **Source.** `blur`, window `blur` and `visibilitychange` all call `interrupt` (`app.ts:403-406`).
- **Monkeytype, observed.** It shows "tab > enter – restart test" and "esc or ctrl+shift+p – command line" key tips on the test and results pages (`mt04`, `mt06`).
- **Recommendation.** Define and display a small shortcut set, for example Tab+Enter or Escape to restart, and Enter on results to go again. On focus loss, *pause visibly* with "Paused — press any key to resume", or end and discard with a clear message, instead of silently continuing the timer and flagging the run. Keep the integrity label for the assessment benchmark.
- **Acceptance.** Shortcuts appear on the typing and results screens and work from the keyboard alone. Losing focus during a run produces an in-viewport state change within 200 ms. Practice runs are not silently excluded without an on-screen explanation at the moment it happens.

### F8 — Medium. The results page leads with analysis jargon instead of "how did I do / what next". Evidence O+S, confidence high.
- **Internal identifiers.** The prediction panel shows "smoothed-pair aalto-smoothed-pair-k1-v1 · experimental aalto-ridge-83f562c419d5 · 59 matched observations · observed 121.5 ms · baseline 134.1 ms · candidate 145.7 ms" (`d15`, `app.ts:600`).
- **Confusing empty rows.** For non-QWERTY runs it shows "Sentences without saved comparisons 3 / Not recorded" (`d11`). That is 3 while "Submitted sentences" is 2, because the partial sentence is counted.
- **Noise shown as signal.** "Observed pair timing" lists the six *slowest* pairs, each from a single observation ("oo 135.6 ms · 1 observation", `d15`, `app.ts:660-661`). That presents noise as signal next to text saying it is an observation.
- **Odd emphasis.** The pace chart starts with an artefact dip in the first seconds (`d11`). "Characters deleted" gets equal weight with WPM.
- **Recommendation.** Lead with WPM, accuracy and one human-readable takeaway, such as "Most misses: e (1 of 13)", with the next action beside them. Move the model comparison behind a "How the model did on this run" disclosure that links to the Lab. Hide pair rows below a minimum count, or label them "too few to compare". Wording is for the ML lane to validate.
- **Acceptance.** The above-fold result at 1440×900 contains the headline metrics, one takeaway and the primary next action. No internal version IDs appear outside a disclosure. No per-pair statistic is ranked with fewer than the agreed minimum observations.

### F9 — Medium. Progress does not show practice. Evidence O+S, confidence high.
- **Observed.** Three runs were saved, two of them practice, yet the trend reads "96.8 WPM average across your latest 1 eligible assessment… Bucket: 15s · Space flow · QWERTY declared · en · 1" (`d18`, `r07`). The trailing "1" is the corpus version (`corpus.ts:3`), which is meaningless to users. Practice sessions appear only as table rows.
- **Missing daily-practice signals.** There is no time practised, days practised, sessions this week or per-key trend. The page's primary CTA is "New assessment ↗" (`app.ts:667`), even though the user mostly practises.
- **Recommendation.** Show a practice-volume view (minutes and days, last 7/30 days) alongside the assessment trend. Plain-language bucket labels. Make the primary CTA continue practice. Any streak or goal mechanic is a decision for Owen.
- **Acceptance.** After N practice sessions, Progress visibly reflects them in a summary (not only table rows). No raw version identifiers appear in user copy.

### F10 — Medium. Accessibility semantics: likely over-announcement and colour-only typed state. Evidence S + aria snapshot; not tested with a screen reader; confidence medium.
- **Live regions.** Timer, WPM and accuracy are `<output>` elements (`app.ts:187`). The aria snapshot exposes each as `status` (`aria-practice.yml`), and the page repaints them every 100 ms (`app.ts:497,502`). This likely makes screen readers announce timer ticks and WPM changes, contrary to `DESIGN.md` ("never announce each glyph or timer tick"). This is a hypothesis until it is tested with NVDA, VoiceOver or JAWS.
- **Typed vs untyped.** Typed text is distinguished from untyped by hue only: teal vs blue-grey, with a luminance ratio between them of 1.24:1. The caret position mitigates this, but users with colour-vision deficiency get a weak signal.
- **Orphan label.** A visible "Pair" label remains beside a hidden select (`d04`, `app.ts:185`).
- **Positives.** Labelled textarea, `role=status` on the run state, skip link, visible focus.
- **Recommendation.** Use non-live elements, or `aria-live="off"` with periodic summarised announcements, for the timer and metrics. Add a non-hue cue for typed text, such as weight or underline. Hide the label together with its control.
- **Acceptance.** No live region updates more often than at milestones, such as halfway, 10 s left and completion, verified with at least one real screen reader. Typed and untyped states differ by a non-hue cue.

### F11 — Medium-Low. ML Lab gets primary-nav weight but has no presence in practice. Evidence O, confidence medium.
- **Observed: Lab.** "ML Lab" sits in the primary nav with the same weight as Practice (`d01`). The Lab is a dense evaluation report: MAE, bootstrap CI, splits, exclusions and raw JSON (`d19`, `d20`). It is honest and inspectable, but it is a destination for reviewers, not typists.
- **Observed: practice.** The ML is invisible exactly where it could help. Recommended was disabled in every observed run (`d16`), and the results-page prediction panel speaks to evaluators.
- **Impact.** For typists, the nav item is a distraction. For reviewers, the link between model and practice is not demonstrated in the product flow. This echoes Owen's "the ML has nothing to do with the actual typing".
- **Recommendation (design side only).** Move ML Lab to a secondary location (footer or "About the model"). Bring a *user-facing* consequence of the analysis into practice: for example, "Why this drill?" on a recommended block, with the evidence count and a link to the Lab. Whether a learned model should drive that choice belongs to the ML and learning lanes. The UI should not imply it does until they validate it.
- **Acceptance.** Typists can complete daily practice without seeing ML jargon. Any recommendation shown has a one-line, plain-language "why", and every model claim links to the Lab evidence.

### F12 — Low. The home hero promises interaction and over-signals the assessment. Evidence O+S, confidence medium.
- **Fake typing box.** The hero "preview" is a tilted, typing-box-like card with a caret and a `space` keycap, but it is decorative (`aria-hidden`, `app.ts:111-114`). On mobile it looks like the real input (`m01`).
- **External-link arrow.** "Take an assessment ↗" uses an external-link arrow for an internal link.
- **Assessment as primary.** Assessment is the primary teal CTA, while daily practice is secondary.
- **Recommendation.** Replace the preview with the real surface, or remove it. Make practice the primary first-use CTA if the product goal is daily practice, unless Owen decides otherwise.

### F13 — Low. Small craft issues during typing. Evidence O.
- **Completed passages lose their history.** They revert to uniform grey, so errors in them are no longer shown (`d09`).
- **Wasted space.** At desktop the bottom third of the 245 px surface is empty (`p05`).
- **Inconsistent controls.** The practice select uses a larger font than the duration select (`d04`, `style.css:166` vs the default `select` font).
- **Noisy early WPM.** Live WPM swings widely in the first seconds (log: 41 → 36.9 → 77.7). This is a further argument for hiding it by default.

## 5. Monkeytype comparison by user journey

"Observed" means exercised this round on v26.43.0 live, or at source commit `3aa6c2e` where marked. **UNTESTED** labels journeys I did not exercise.

| Journey or quality | TypeForge (local `de69444`) | Monkeytype v26.43.0 | Verdict |
|---|---|---|---|
| Landing → first accepted keystroke (first visit, desktop) | Home → click "Just practise" → click the exact passage line → type. That is 2 clicks, or 18 Tabs + 1 Enter keyboard-only (F1). Duration needs one more interaction. | Consent dialog first (third-party CMP, observed from this network location; may be region-dependent), then the first keypress focuses the test (`mt01`, `mt03`). | TF is worse on focus; MT is worse on the first-visit wall. |
| Returning visit → typing | 3+ interactions: nav, re-pick duration, focus click. Settings forgotten (F3). | Reload keeps 15 s selected and focuses the input (`mt08`). | **MT clearly better** |
| Focus recovery | No unfocused state shown. Blank surface is not clickable. Blur silently flags the run (F1, F7). | "Click here or press any key to focus" overlay (`mt09`). | **MT better** |
| Restart / shortcuts | Restart button. Tab+Enter works by accident, undocumented. Escape does nothing (F7). | Documented Tab>Enter, Esc / Ctrl+Shift+P command line (`mt04`). | **MT better** |
| Active-typing chrome | Nav, headings, dimmed settings, live WPM/accuracy and four paragraphs stay visible (F5). | All chrome fades; mini timer only; live stats off by default (`mt05`, default-config). | **MT better** |
| Error and correction rendering | Wavy underline, tint and a textual "expected X" hint. Extra letters overwrite target glyphs (F6). | UNTESTED visually this round. My scripted run produced errors, but I captured no close-up. | Unknown |
| Native editing (selection, Ctrl+Backspace) | Works and is mirrored (`p02`). | UNTESTED | TF strength (unconfirmed relative) |
| Result → next | Long page. Practice-first users get a wrong "deleted" message and an assessment CTA. "Keep practising" is at the bottom (F2). | One-viewport result, next-test button under the stats, key tip (`mt06`). | **MT clearly better** |
| Result content | Honest metrics, explanation disclosure, key first-attempt errors, pair timing, model comparison with internal IDs (F8). | WPM, acc, raw, characters, consistency and an errors-over-time chart (`mt06`). | MT is more glanceable; TF is more explanatory but jargon-heavy. |
| Saving history | Local, no account, with export and delete (`d18`). | "Sign in to save your result" for guests (`mt06`). | **TF better** for privacy and no-friction saving |
| Progress / daily habit | Assessment-only trend; practice invisible (F9). | Account-based profile and history: UNTESTED (no account used). | Unknown; TF's is weak |
| Adaptive or targeted practice | Manual pair drills; Recommended gated (disabled in all runs). | UNTESTED (not explored; not in default flow). | TF has a differentiating idea, not yet delivered to users |
| Content | 80 practice and 40 assessment everyday lowercase sentences (`corpus.ts`). | Random common words, English (`mt04`). | Different by design; TF sentences are friendlier for reading-ahead. |
| Visual calm and distraction | No ads, banners or consent prompts. | Merch banner, ad slot, cookie wall (`mt01`, `mt06`). | **TF better** |
| Mobile 390 | Surface top 625/844; mid-word wraps (F4). | Words at about 238 CSS px top; unfocused overlay. Typing on mobile UNTESTED. | MT layout better; both unverified for IME |
| Accessibility (SR, AT) | Labelled; likely live-region over-announcement (F10); SR UNTESTED. | UNTESTED | Unknown |

Overall, TypeForge's typing *engine*, honesty and calm are competitive or better. On the observable daily journeys, Monkeytype is clearly better on every "get me typing and keep me typing" step: entry, return, focus, restart, run-time focus and result → next. Those steps decide whether people practise daily.

## 6. Daily-practice vertical slice: candidate directions

None of these is assumed to be the final design. Each still needs evidence from the learning and ML lanes about what the practice blocks should contain.

### Direction A — "Ready surface" (typing-first workspace). Recommended as the foundation.
**Shape.** Returning users land directly on a focused typing surface with their remembered settings shown as a compact summary chip. Chrome fades during a run. Results appear as a compact panel in place, with Again (Enter or Tab+Enter) as the default, and details are a click away. Home's marketing hero is shown only to first-time visitors, or replaced by a one-screen first-run setup that asks once about duration and keyboard.

**Acceptance criteria.**
- With saved prefs, 0 interactions between page load and the first accepted keystroke.
- Repeat via a single keystroke chord.
- Active line top at or above 45% of the viewport at 1440×900 and 390×844.
- During a run, only the surface, a mini timer and the restart affordance are visible.
- All run-time warnings inside the viewport.
- F1–F7 acceptance criteria met.

**Tradeoffs.** Closest to Monkeytype's proven interaction model, which raises a "copy" risk. Mitigate that with TypeForge's own identity: sentences, calm navy and teal, honest explanations, local-first. Moderate engineering effort, because it mostly reorganises existing pieces. It risks hiding assessment and ML depth from reviewers unless those get clear secondary entry points.

### Direction B — "Today's session" (guided short sequence) layered on A
**Shape.** One daily CTA starts a short sequence of blocks, for example warm-up, then focus drill, then a check. The focus block's content comes from the user's own error and timing history, with a plain-language "why this". The sequence ends in a single "Today" summary, and progress shows days and minutes practised.

**Acceptance criteria.**
- The daily CTA is visible on load for returning users.
- Each block auto-advances with an explicit "continue" step and no navigation.
- Every targeted block shows its reason and evidence count.
- The summary shows today's blocks and an honest comparison only against compatible prior sessions.
- No improvement claims without the learning lane's evidence.

**Tradeoffs.** It gives the ML a user-visible role, which is Owen's concern. It also makes the product feel like daily practice rather than a test. However, it depends on validated selection logic and enough data to target well; cold-start users need a sensible non-ML default. It costs more design and engineering effort than A, and a block structure can feel prescriptive to users who want a quick test.

### Direction C — Polish only (keep the current information architecture)
**Shape.** Fix F1–F10 inside the current pages: autofocus, persistence, correct coach copy, a fold-safe layout, a cleaner result and quieter live regions.

**Tradeoffs.** Lowest risk and quickest. It would not address "right now all it really is is a typing test", and Home, Practice, Progress and Lab would still be organised around the assessment protocol.

**Recommendation.** Do C's defect fixes first, because they are needed under any direction. Build A's surface and flow as the vertical slice, then add B's "Today" sequence only once the learning and ML lanes agree on the block-selection logic and an evaluation plan.

## 7. Decisions that need Owen's input

1. **First screen for returning users.** Should it be the ready typing surface (A), a "Today" page with one CTA (B), or the current marketing home?
2. **Assessment visibility.** Keep "Assessment" as a top-level mode, or reframe it as an occasional "check-in" inside the practice loop? This affects nav, the results CTA and Progress.
3. **Live WPM and accuracy during runs.** Off by default (as in Monkeytype), on, or asked once at first-run?
4. **Touch and mobile scope.** Is mobile a supported typing platform, or should the product say "physical keyboard recommended" and optimise for the phone as a progress viewer? This needs physical-device IME evidence either way.
5. **Gamification ceiling.** Are streaks, daily goals or minutes targets acceptable, or should progress stay purely descriptive?
6. **ML Lab placement.** Primary nav (portfolio visibility) or secondary placement with in-flow "why this drill" links (typist focus)?
7. **Keyboard declaration.** Ask once and remember, or infer and ask only when targeted drills need it?
8. **Practice content.** Keep only the curated 80 or 40 sentences, or expand (more sentences, word lists, user-chosen text)? This affects how fresh a daily routine feels.

## 8. Unknowns and limitations

- **Headless and synthetic input only.** All typing came from Playwright key events in headless Chrome 157. There was no physical keyboard, OS IME, screen reader, Firefox or Safari, and no real browser-UI zoom (720×450 was an approximation). Mobile results are simulated-viewport geometry. They are **not** physical-mobile or IME evidence, and the on-screen-keyboard occlusion in F4 is inference.
- **Automation artifacts.** WPM and accuracy figures for both products measure automation cadence; Monkeytype's 76% accuracy comes from the script reading letter nodes. Scripted cadences do not test caret latency under human rhythm or perceived smoothness.
- **Monkeytype coverage.** Exercised as a guest only, with no account, profile or history, and mobile typing was not run. The first consent dialog could not be dismissed by a normal pointer click under automation and needed a DOM click (log `cmp reject fail`). The appearance of that dialog may depend on region.
- **Untested TypeForge paths.** The 120 s runs, the safety stop, storage failure and retry, corrupt records, legacy redirects, Manual/Recommended *completed* runs (Recommended was never unlocked), and the delete flow were not exercised in the browser.
- **Deployed demo.** Inspected only for reference. There is no evidence equating it to `de69444`.
- **Old screenshots.** I did not use `docs/screenshots/*`. All images in this review were captured in this session.

## 9. Evidence manifest (`docs/reviews/2026-11-15/design-evidence/`)

All captures are from 2026-11-15 between 14:59 and 15:13 UTC. TypeForge captures come from the local dev server at `de69444`; logs record the exact URLs.

### Desktop first use (1440×900)

| File | Shows |
|---|---|
| d01, d02 | Home, first visit (viewport and full page) |
| d03 | Focus ring on "Just practise" after 8 Tabs |
| d04, d05 | Practice idle, first visit (input not focused) |
| d06 | Practice after 10 Tabs to the textarea |
| d07 | Error mid-run ("thq"), correction hint rewrap |
| d08 | Immediately after Enter: no visible change in viewport (warning off-screen) |
| d09 | Mid-run at 7 s: previous, active and next lines; chrome still visible |
| d10, d11 | First general-practice result; "deleted" coach copy |
| d12 | Assessment defaults |
| d13 | 15 s QWERTY assessment configured |
| d14, d15 | Assessment result: internal IDs, single-observation pair list |
| d16 | Coach CTA landing (unfocused, Recommended disabled) |
| d17, d18 | Progress |
| d19, d20 | ML Lab |

### Returning visit (same profile)

| File | Shows |
|---|---|
| r01 | Home, unchanged |
| r02 | Practice defaults reset to 60 s, unchecked, General |
| r06 | Practice result, still "Set a new assessment baseline" |
| r07 | Progress |

r03–r05 were deleted: that probe ran without focus. The log records this.

### Focused interaction probes

| File | Shows |
|---|---|
| p01 | Caret when focused |
| p02 | Shift+Arrow selection mirrored |
| p03 | Extra letters overwrite the expected "ed " |
| p04 | Tab mid-run: focus on Restart, warning off-screen |
| p05 | After four passages |

### Mobile (390×844)

| File | Shows |
|---|---|
| m01, m02 | Home |
| m03, m04 | Practice idle |
| m05 | Mid-run, mid-word wrap |
| m06 | Error |
| m07, m08 | Result |
| m09 | Progress |
| m10 | Lab |

### Stress checks

| File | Shows |
|---|---|
| s-320-* | 320×640: practice (Manual pair "th") and home |
| s-zoom200-approx-* | 720×450 approximation of 200% zoom |

### Monkeytype

| File | Shows |
|---|---|
| mt01 | Consent dialog on first visit |
| mt02 | After consent dismissed |
| mt03 | After first keypress, focused (the stray first key is absorbed; the test is still idle) |
| mt04 | 15 s selected, idle, key tips |
| mt05 | Running: chrome faded |
| mt06, mt07 | Result |
| mt08 | Reload keeps 15 s |
| mt09 | Mobile, unfocused overlay |
| mt10 | Mobile after a tap attempt; overlay persisted under automation, so mobile typing is UNTESTED |

### Deployed demo and data files

| File | Shows |
|---|---|
| dep01, dep02 | Deployed demo, reference only |
| `aria-practice.yml`, `aria-results.yml` | Playwright aria snapshots |
| `*-log.json` | Step logs: timings, active elements, geometry, saved-result summaries |
| `harness/*.mjs` | Exact scripts used. They need `playwright-core` from outside the project and the 5187 server. |

### Helper lifecycle
- Vite dev server: PID 25688 on 127.0.0.1:5187. I stop it at the end of this lane.
- Playwright contexts: closed by each script.
- Temporary profiles: in the session scratchpad only.
