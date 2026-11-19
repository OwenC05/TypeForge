# Prototype comparison: A (refined current layout) vs B (practice stage)

15 November 2026. Lead: actual Claude design lead, Task `task_5817cddd1505`. Inputs: the two child reports, their evidence packs and screenshots, and the lead's own independent reruns (`lead-check/`). This document compares two concrete, working prototypes for Owen's visual-direction checkpoint. It does not integrate either one, change `DESIGN.md`, or claim human preference, learning, AT, IME or device results.

## 1. Where to find and run them

| | Prototype A: refined current layout | Prototype B: practice stage |
|---|---|---|
| Orca Task / Dispatch | `task_74799868105e` / `ctx_7580ccf8894c` | `task_094a1c671af7` / `ctx_3b394838fd60` |
| Branch | `OwenC05/tf-proto-a` | `OwenC05/tf-proto-b` |
| Worktree | `C:\Users\Owenc\orca\workspaces\TypeForge\tf-proto-a` | `C:\Users\Owenc\orca\workspaces\TypeForge\tf-proto-b` |
| Final commit | `0ee69ec` | `5e763aa` |
| Base | `0400a43` (application source = `de69444`) | same |
| Source files changed | `src/app.ts`, `src/style.css` | `src/app.ts`, `src/style.css`, `tests/app.test.ts` (context stubs plus one intended assertion change, below) |
| Preview | `cd typing-app/client && npm run build && npm run preview -- --port 5291 --strictPort` → `http://127.0.0.1:5291/` | same with `--port 5292` → `http://127.0.0.1:5292/` |
| Evidence | `docs/implementation/2026-11-15/design/prototype-a/` (`report.md`, `notes.md`, `geometry.json`, `zoom.json`, `prefs.json`, `motion.json`, `typing-flow.json`, 53 screenshots) | `docs/implementation/2026-11-15/design/prototype-b/` (`report.md`, `notes.md`, `geometry.json`, `acceptance-probes.json`, `typing-flow-result.json`, 45 screenshots) |

The two ports differ, so both previews can run side by side. `node_modules` already exists in both worktrees. Nothing is pushed or deployed. Each worktree is an independent source tree, and the two were never merged.

**Model receipts.** Both children: requested `--agent claude --model claude-opus-5-5 --effort high`. Orca's start receipt echoed `model: claude-opus-5-5, effort: high`. Each child reports observing `claude-opus-5-5` from its session context, with applied effort unknown. Lead: `claude-opus-5-5`, inherited, applied effort unknown. No Codex child was used, because the two-child budget went to the design directions.

## 2. What each direction is

**A keeps today's structure** (Home → Practice → Results page → Progress) and fixes its hierarchy:
- run chrome is hidden in place (`visibility:hidden`, keeping its space);
- the passage is the dominant object;
- added: a reserved feedback slot, the first-mismatch marker with the geometry pointer, and a scrim with a **Continue typing (Enter)** button for focus recovery;
- the Results page leads with "How it went", with focused **Again** for practice and **Practice next** for assessment;
- returning Home is a "Pick up where you left off" card with remembered-settings chips, Continue, and the last session;
- Progress gains a practice-activity panel separate from the assessment trend.

**B makes the stage the product:**
- Home for a returning user is the ready stage, with the input focused and settings in a compact chip ("Practice · 15 s · General · keyboard not declared · Change");
- a strip of observed facts sits above the stage;
- run chrome is a mini timer and a quiet Restart, and the header and strip fade to 0 opacity during the run;
- the result appears in place with a focused **Again**, "Same settings, new run", and Details;
- a first visit gets a short first-run panel (duration radio set, optional QWERTY, Start practising) instead of the marketing hero.

## 3. Same criteria, side by side

All values come from the children's evidence unless marked *(lead)*.

| Criterion | A | B |
|---|---|---|
| Real engine; engine, corpus, storage, profile and model unchanged | Yes | Yes |
| Prompt IDs and saved settings byte-identical at 320/390/1440 | Pass (assessment, practice-from-assessment, retest) | Pass (practice, manual `th`, assessment, retest) |
| Active-line top, 1440×900 ready / running | 28.1% / 28.1% | 22.1% / 27.0% |
| Active-line top, 390×844 ready / running | 31.0% / 31.0% | 26.8% / 34.4% |
| 320 px: visible after focus without scroll | Pass (334 / 365 px of 640) | Pass (24.5% ready) |
| Passage size 1440 / 390 / 320 | 26 / 20 / 18 px | 26 / 19 / 18 px |
| Native caret/selection vs mirror (partial word, line-edge extras, middle edit, Shift+Arrow across a line, click-to-caret, selection replacement, Backspace, Ctrl+Backspace, commit) | 26/26 steps per width; hit-test sweep 39/39 | 13/13 cases per width; hit-test agrees for every typed glyph; **141-width sweep 0 disagreements** after column snapping |
| Word-safe wrapping | **Not resolved**: `break-all` kept, no tape | **Not resolved**: `break-all` kept with column-snapped width, no tape |
| Zero displacement on error, hint, Undo, integrity and focus events | Pass at 3 widths | Pass at 3 widths (CLS > 0 only at the intentional passage commit, ≤ 0.012) |
| Marker at first mismatch; pointer only off-line or off-stage | Pass (off-line). Scrolled-out branch untested. | Pass (off-line **and** scrolled-out, 320 probe) |
| Reserved slot, priority, announce once | Pass (DOM) | Pass (DOM) |
| *Why?* inert while running | Disabled button *(lead: confirmed at 3 widths)* | Disabled button *(lead: confirmed at 3 widths)* |
| No global printable-key capture | *(lead: a letter pressed on `body` leaves the input unchanged, 3 widths)* | *(lead: same, 3 widths)* |
| Real 200% browser zoom (Chrome `default_zoom_level` profile preference; DPR 2, innerWidth 704 in a 1440 window) | Pass: placement, no overflow, marker | Not attempted by the child. *(lead: the same method gives DPR 2, innerWidth 704, input top 181/370, no overflow, marker rendered, 0 errors; `lead-check/B-zoom200.json`)* |
| Native-editing agreement under zoom | Untested | Untested |
| Undo: in-run notice and the same consequence on the result | Pass (real run) | Pass (real run) |
| Save failure visible at completion, Retry saves once | Pass | Pass |
| Insufficient evidence → General plus abstention reason | Pass (real thin history) | Pass (real thin history) |
| Uniform-history / artifact-fallback fixtures | Not built | Not built |
| Motion ≤ 150 ms, none under reduced motion | Pass (max 120 ms) | Pass (120 ms fades) |
| `npm test` | 94/97, the 3 pre-existing CRLF failures | 94/97, the 3 pre-existing CRLF failures |
| `npm run build` | Pass | Pass |
| `tests/browser/typing-flow.js` | 39/39 unmodified (base URL only) | 35/2 unmodified. Both failures wait for `results.html` navigation, which B removes by design. 39/0 with those two waits replaced. |
| Practice summary | Progress panel (Today / 7 days / All; time zone labelled); Home "Today" line | Strip on the stage ("Today: 1 practice block · 30 s recorded · 1 flagged (30 s, excluded) · 1 assessment"), with **no time-zone label**; Progress panel labelled |
| Actions, returning user → first accepted key | Home → **Continue practising** (1 click), then autofocus | **0**: the stage is ready and focused on load |
| Actions, repeat a practice block | Auto-navigation to Results, then Again focused → Enter (1 key, 2 navigations) | Again focused in place → Enter (1 key, 0 navigations) |

**Lead independent checks** (`lead-check/`; own ports 5293/5294; run one at a time; profiles deleted):
- **Both prototypes:** fresh production builds, no page errors at 1440/390/320. Native value and selection stayed correct through a substitution, five Backspaces and Ctrl+Backspace. Direct-route autofocus landed on `#typing-input`.
- **B's legacy and deep links:**
  - `TypingDrill.html` → `practice.html?mode=practice`;
  - `TypingTest.html` → `practice.html`;
  - `results.html?id=` still renders a result page and gives an explained failure for a missing ID;
  - Progress and Lab load.
  This does **not** prove these match the baseline's copy.

**B's test change:**
- B edited `tests/app.test.ts` to add context stubs (`mayFocusInput`, `setRunState`, `resultPanel`, …) needed by the handler-extraction tests.
- One assertion changed, in the retryable save-failure case: `navigations === 1` became `navigations === 0` plus `status` "Saved in this browser". This reflects B's in-place result and adds a check. I reviewed the diff, and no engine, scoring or lineage assertion was weakened.
- If B is selected, the committed `typing-flow.js` navigation waits must change deliberately in that integration.

## 4. Design reading of the screenshots

Same states, same widths. I read the s01, s03–s05, s07, s09, s11 and s13 sets at 1440 and 390, the 320 focus-loss and running states, and both zoom captures.

**Shared and good in both.**
- The passage now reads as the object of the page, at 26 px in a clear stage.
- Teal is reserved for typed-correct text, the primary action and focus, so it finally means "this, now".
- Errors carry tint plus a wavy underline and a small expected-glyph label, so colour is not the only signal.
- The focus-loss state is honest and recoverable: a large Continue typing button and a flagged notice in the slot, with the slot height stable.
- Neither prototype imitates Monkeytype's or Keybr's look.

**A's strengths.**
- Lowest structural risk. The routes, the results page and the `typing-flow.js` contract are untouched.
- The results page has room for a full "How it went" summary with the next action above the fold. Details, export and delete stay on the same page.
- The returning Home card is a readable "welcome back" with explicit remembered settings and a visible **Reset remembered settings**.
- The only child to measure real 200% zoom.

**A's weaknesses.**
- Hidden chrome keeps its space, so at 390 a large empty band sits above the stage during a run. At 1440 the stage reads as a box in the middle of an otherwise empty page.
- Repeat still costs a page change each block, and the result page carries more reading before Again than B's in-place panel.
- Returning users still pass through a Home page before typing, which is the F1/F3 friction the review identified, softened rather than removed.

**B's strengths.**
- The daily loop is shortest and calmest: open → type → result in place → Enter → type.
- The strip turns saved history into visible activity without inventing goals or streaks.
- The first-run panel replaces the marketing hero with the two decisions that matter (block length, optional QWERTY) and a single start.
- Strongest geometry evidence: column snapping makes mirror and textarea wrap identically across a 141-width sweep. It also exercised the scrolled-out pointer branch.
- Lowest active line on load (22% at 1440).

**B's weaknesses.**
- It restructures navigation, so the integration costs more: the `typing-flow.js` waits change, the deep and legacy links need baseline-copy parity checks, and Home and Practice now overlap conceptually.
- The today strip lacks a time-zone label.
- Its success depends more on direct-route autofocus being acceptable for AT users. That is untested, and the PRD requires falling back to post-action focus if it fails.
- Header and strip fade to opacity 0 during a run but stay in the tab order, coming back on focus-within. The behaviour is acceptable, but it needs an AT check.
- At 1440 the in-place result panel is compact, so more of the screen is empty below it.

**Concerns common to both.**
- The expected-glyph label is small (about 11 px). A space renders as a tiny glyph that is hard to read at 1440 (A s05, B s04).
- Lowercase `l` vs `1` can be confused in A's label font (390 s04).
- Neither resolves word-safe wrapping. Words still split at line ends at narrow widths.

## 5. Recommendation

**My design recommendation is to adopt B's structure, taking these parts from A.** The decision is Owen's, at this checkpoint.

**Why B.** UX is a primary adoption hypothesis here, and B directly removes the two frictions the review measured: entry for a returning user, and the repeat loop. It does this without weakening any evidence boundary. Prompt identity, assessment lineage, Undo honesty, save failure, abstention and native editing all hold at the same level as in A. B's geometry evidence (the 141-width sweep, the scrolled-out pointer) is also the stronger of the two.

**Carry over from A, or fix during integration:**
1. Keep A's real-zoom method as a standing check. It now covers both: the lead ran it against B.
2. Add a visible "Reset remembered settings" equivalent to B's Change/chip flow.
3. Label the time zone on B's today strip.
4. Enlarge the expected-glyph label and give space a clear visible symbol in both. Choose a label font that distinguishes `l` from `1`.
5. Update the `typing-flow.js` navigation waits deliberately, with the reason recorded.
6. Verify B's legacy and deep-link copy against the baseline.

**Reasons Owen might prefer A instead:**
- He values keeping today's page structure and lower integration risk;
- he wants Results as a full page rather than an in-place panel;
- he wants Home to remain a distinct welcome surface rather than the stage itself.

A is a complete, honest improvement and loses nothing on evidence. It only does less for the daily loop.

**Neither prototype settles:**
- whether people actually prefer either one or return more often;
- whether direct-route autofocus is acceptable with a screen reader.

Those need the short usability round and the AT check that the PRD already calls for.

## 6. Failed, limited and untested (both unless noted)

- **Word-safe wrapping: not resolved.** `break-all` is kept and no narrow-screen tape was prototyped. B adds column snapping, which proves agreement but does not stop words from splitting.
- **Native-editing agreement at real 200% zoom:** untested. Only placement, overflow and the marker were checked.
- **A only:** the scrolled-out pointer branch is untested.
- **B only:**
  - the today strip has no time-zone label;
  - whole-run CLS is non-zero at the intentional passage commit;
  - the unmodified `typing-flow.js` fails its 2 navigation waits;
  - the stale-async and moved-focus guards have no browser case.
- **Uniform-history (ML-04) and artifact-fallback (ML-05) UI fixtures:** not built in either.
- **Recommended/Manual Again and recommendation revalidation in a browser:** untested. Real thin histories never yielded a recommendation.
- **Bounded reads (Stage 1C, out of this lane's scope):**
  - A leaves Progress reading full history, as in the baseline, and reads one 50-row page for Home.
  - B reports its activity reads as ≤ 5 pages × 100 rows. That is within the PRD's 500-row lookup cap but exceeds its 25-row slice size. I did not verify whether B's Progress panel is bounded.
  - Neither meets the Stage 1C contract yet.
- **QWERTY "ask once":** A has a chip only. B asks in the first-run panel, but there is no separate later prompt.
- **E3 input performance:** not measured. Benchmarks were deliberately not run while sibling builds and browsers were active, so non-regression remains an open gate.
- **Untested evidence categories:** human preference, the five-second glance test, feedback comprehension, return frequency and learning effects; screen readers and other AT (announce-once and autofocus are DOM-verified only); OS IME composition; physical phones and tablets, including on-screen-keyboard occlusion of the slot and Restart; Firefox and Safari (CSS `round()` used by B's column snapping is unverified there). All automated typing used Playwright key events in headless Chrome 157 with an accelerated clock, so WPM figures in the screenshots measure the script, not a person.

## 7. Resources and cleanup

- **Children:** each child reports stopping its own preview (5291, 5292) and harness browsers.
- **Lead:** ran previews on 5293 (A) and 5294 (B) hidden and one at a time, stopped them by PID, and confirmed both ports were not listening. No lead Chrome processes remain, and the lead profiles were deleted.
- **Builds:** the lead rebuilt `dist/` in both child worktrees for these checks. `dist/` is gitignored, and the lead made no commits there.
- **Tooling:** playwright-core 1.56.1 is in the lead scratchpad only.
- **Untouched:** Portfolio, the original checkout, `typeforge-daily-practice` and `typeforge-foundation`.
