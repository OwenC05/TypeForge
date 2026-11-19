# Claude follow-up: Keybr comparison and challenge of the UX benefits

Status: planning-only challenge, 15 November 2026. It authorizes no implementation.

The request is `.omx/plans/typeforge-claude-benefit-review-request.md`, plus two coordinator status messages:
- `msg_af8eaa9bb07a`: UI scope.
- `msg_8025f1616905`: Architect's wrap/caret constraint.

I did not edit my initial report (`docs/reviews/2026-11-15/design-review.md`). Corrections to it are listed in §4 below.

## 0. Receipt and scope

**Provider.** Requested: actual Claude, inheriting the completed design lane's model and effort. Observable: Anthropic Claude `claude-opus-5-5`, as stated by this session's system context. The original design dispatch requested effort `high` (`design-launch.json`). **The effort actually applied is unknown.** I have no argv or dispatch proof of it from inside the session.

**Plan drafts reviewed.** Both match commit `b9a2fb9`; `git diff` against it was empty.

| File | sha256 prefix |
|---|---|
| `.omx/plans/prd-typeforge-review-breakdown.md` | `f956f7b9202c3348` |
| `.omx/plans/test-spec-typeforge-review-breakdown.md` | `20f5c29ab41be385` |

**Other inputs read.**
- `learning-review.md`, read in part: structure, L6–L8, the proposed mechanism and the decisions.
- `.omx/context/typeforge-review-breakdown-20261115.md`.
- `.omx/reviews/typeforge-20261115/reconciliation-notes.md`.

**Not used.** An engineering report and evidence appeared, staged, in the worktree while I worked, along with untracked `ml-evidence/`. I did **not** read them. Per the brief, the ML and engineering lanes are treated as still pending.

**TypeForge source.** HEAD is now `b9a2fb9`. `git diff de69444 HEAD -- typing-app` is empty, so my earlier TypeForge evidence still describes current application source.

**Owned artifacts.**
- `.omx/plans/typeforge-claude-benefit-review.md` (this file).
- `.omx/plans/typeforge-keybr-evidence/`: screenshots, `keybr-log.json`, aria snapshots and `harness/*.mjs`.

**Owned helpers.**
- Headless Chrome 157.0.8103.52 through `playwright-core@1.56.1`, installed in the session scratchpad only.
- Fresh persistent profiles `profile-keybr-recon`, `profile-keybr-desktop` and `profile-keybr-mobile`, all in the scratchpad.
- No dev server was needed this round. Every browser context was closed by its script, and no Portfolio browser or process was touched.

## 1. Live Keybr evidence (observed 2026-11-15, 15:53–15:59 UTC)

**Target.** https://www.keybr.com/. Response date header `Sun, 15 Nov 2026 15:55:11 GMT`, served via Cloudflare. I found no version string on the page. Source reference: GitHub `aradzie/keybr.com` master `05a37bc5265f65ff538c59c613db29442f345d51` (2026-09-28); live parity with that commit is unknown.

**Input.** All typing was Playwright `keyboard.type`/`press` at about 100–120 ms per key. That is synthetic, not human typing, and it is faster than Keybr's default 35 wpm target. Viewports: 1440×900, and 390×844 with `isMobile`/`hasTouch` (a simulated viewport, not a physical device).

| # | Journey step | What I observed | Evidence |
|---|---|---|---|
| K1 | First visit | Load took about 5.0 s to a settled screen. The lesson textarea already had focus. A 12-slide guided tour opened automatically, explaining touch typing, the adaptive letter-subset method, the text board, a finger-zone keyboard, speed, accuracy, score, the key-confidence ribbon and current-key detail. No consent dialog appeared in this session. | `k01`, `k02-tour-slide-02…12`, log |
| K2 | Ready state after closing the tour (Escape) | One centred column: metrics row, "All keys" ribbon (locked letters struck through), current key ("Not calibrated, need more samples"), accuracy streaks, **Daily goal 0%/30 minutes**, two lines of words with `·` separators, and a colour-coded keyboard. A narrow right sidebar holds navigation. There are no settings controls between the user and the text. | `k03` |
| K3 | Errors | After a wrong key ("q" for "a"), the cursor did **not** advance (`k04b`). The missed letter was later shown in red within the completed text (`k06`). Backspace did not have to remove a wrong glyph. | `k04b`, `k05`, `k06` |
| K4 | Lesson → next lesson | There is no result page. Finishing a lesson immediately replaces the text with a new lesson, and the metrics update in place with deltas, e.g. "Speed 90.6wpm (↑+4.7wpm)". Four lessons were completed, each about 16–18 s and 118–125 characters. | log `lesson 1…4 complete`, `k07` |
| K5 | Progression | After 4 synthetic lessons, letters E N I A R L T O S turned green, **U unlocked**, and "Top score!", "Top speed!" and "New letter unlocked!" toasts appeared. Accuracy streaks read "3 lessons with 100%…". The daily goal reached 3%/30 minutes. | `k08`, `k08b` |
| K6 | Profile | All-time and today statistics, accuracy streaks, and a "Relative typing speed" histogram against all users ("beats 95.93%…", produced by synthetic typing). | `k09`, `k09b` |
| K7 | Settings | Lesson modes: Guided, Common words, Books, Custom text, Source code, Numbers. Target speed defaults to 35 wpm. Options include unlock rules, natural vs pseudo words and repeat-each-word, each with long inline explanations and sticky Reset/Done buttons. | `k10`, `k10b`, log |
| K8 | Focus loss | Clicking outside blurs the text, shows a hands-on-keyboard illustration and the prompt "Click or press Enter to activate…". Pressing "a" did **not** refocus. | `k11`, log |
| K9 | Keyboard navigation | Eight Tab presses from the lesson all left focus in the textarea, so Tab is consumed while typing. This was observed in headless Chrome; I did not test whether another keyboard path to the settings exists. | log `tab order` |
| K10 | Returning visit (new browser session, same profile) | The tour did not reappear. Progress and metrics persisted, and the textarea was focused on load. | `k12`, log |
| K11 | Mobile 390×844 | The layout is not responsive: `scrollWidth` was 728 against a 390 viewport. Metrics, text and keyboard were clipped on the right, and the first-visit tour dialog sat largely off-screen. Simulated key events typed into the lesson. | `k13`, `k14`, `k15`, log |
| K12 | Advertising and identity storage | `localStorage` held ad and identity keys (`id5id_*`, `_pubcid`, `apstag…`, `_cc_id`); only their lengths were recorded. A "Remove Ads" link is present. | log `local storage keys` |

**What K5 does and does not show.** It shows the *interface* of progression. It does not validate Keybr's adaptive algorithm or its claims ("sophisticated computer algorithm… best learning experience", "improve your typing speed and accuracy dramatically"). Those are **site claims** that I did not measure. A synthetic 100 wpm typist unlocking a letter after four lessons says nothing about human learning.

**Not exercised on Keybr:** accounts, high scores, multiplayer, the separate Typing Test page, any non-guided lesson mode, changing a setting and confirming it persists, theme options, screen readers, IME, physical mobile, or behaviour under a consent regime.

## 2. Three-way comparison: what would make someone choose and keep using each product

Sources:
- **TypeForge:** local `de69444`, which matches current application source. Evidence in `docs/reviews/2026-11-15/design-evidence/`.
- **Monkeytype:** v26.43.0, my prior round. Its first keypress focused the input and was **absorbed, not scored**. Guest only; no mobile typing.
- **Keybr:** §1 above.

"UNTESTED" marks anything I did not exercise. Competitor marketing is not treated as observed behaviour or as a learning benefit.

| Dimension | TypeForge (observed) | Monkeytype (observed) | Keybr (observed) | Implication for TypeForge |
|---|---|---|---|---|
| **Reason to choose it at first sight** | A calm marketing hero promising "evidence-backed focus" and ML. You have to read it to understand the offer. | The test *is* the page. Merch banner and ad space. | A tour explains a *learning method*. The practice screen shows a visible curriculum: key ribbon, current key, daily goal. | Keybr sells "a path"; Monkeytype sells "instant typing". TypeForge currently sells an explanation. It needs a visible, honest *practice path* without Keybr's beginner-curriculum framing. |
| **Time to meaningful practice** | 2 clicks, or 18 Tabs and Enter, from home. Input not autofocused. Duration chosen per visit. | Lands on the test. The first key focuses the input, but that key is absorbed. A consent wall appeared on first visit in that session. | Textarea focused on load, but a 12-slide tour opens first; Escape closes it. After that, typing works immediately. | TypeForge is slowest. Both competitors put the text in front of the user with focus already placed. |
| **Typing comfort** | Large monospace, native editing, three-line rolling context. On narrow screens mid-word breaks and the text sits below the fold (`m05`, `s-320`). | Large text, three lines, chrome fades while typing. | Moderate 22 px mono. Words never split (each word is a `nowrap` inline block). Text sits high on desktop. | Word-safe wrapping and a high, stable active line are the common baseline. TypeForge's geometry contract makes this harder (§5.4). |
| **Visual hierarchy** | Nav, H1, settings rows, timer and live stats, panel, four paragraphs: many competing levels (`d09`). | During a run only the timer and words are visible. | Dense metric labels above the text, but nothing between the user and the text. The keyboard is the dominant visual. | TypeForge's problem is **hierarchy and density, not palette**. |
| **Focus and focus recovery** | No unfocused state. Blank surface does not focus the input. Blur silently flags the run. | "Click here or press any key to focus" overlay. | Blurred text plus "Click or press Enter to activate…"; printable keys did not refocus. | Keybr's *Enter-to-activate* pattern is safer for assistive technology than capturing any key (§5.1). |
| **Understanding feedback** | Wavy underline and tint, plus a sentence like "Correction at character N…" that can rewrap. Extra letters overwrite target glyphs. | Not captured close up (UNTESTED). | Wrong keys do not advance and missed letters stay marked. The model is simple, but it enforces correction. | TypeForge deliberately keeps native free editing; stop-on-error is a different product contract and should not be copied. |
| **Perceived personalisation** | Recommended was disabled in every run. Personalisation is mostly explained, not felt. | None in the default flow (UNTESTED beyond defaults). | Very visible: per-letter colours, current key, unlock toasts. Validity unmeasured. | Perceived personalisation comes from *visible state that changes as you practise*. TypeForge can show honest practice state without inventing a weakness. |
| **Progression** | Assessment trend; practice appears only as table rows. | Requires an account (UNTESTED). | Letter unlocks, streaks, a daily-goal bar, a profile histogram compared with everyone. | Progress needs a practice summary of activity and goal. A population ranking is optional and needs privacy and ethics care. |
| **Settings** | Inline above the text and forgotten on every visit. | A compact config bar that is remembered (15 s persisted). | A separate settings page with deep explanations and modes; persistence UNTESTED. | Remember settings, show a summary chip, and keep a separate settings view. Not every option needs prose. |
| **Accessibility** | Labelled controls, skip link, visible focus ring. Possible live-region chatter is a **hypothesis**. | UNTESTED. | Tab is consumed in the lesson (K9). Key ribbon and keyboard are exposed as unnamed images. Not responsive. Screen readers UNTESTED. | TypeForge's semantic baseline is a real advantage; protect it and prove it with actual AT tests. |
| **Return and repeat** | Nothing remembered; practice results push toward assessment (F2). | Reload keeps settings and focuses; Tab+Enter restarts. | Returning lands on the next lesson with persisted progress. Lessons chain with no result interruption. | **This is the biggest gap.** Both competitors make the *next* repetition the default state. |
| **Interruptions and distraction** | No ads or consent prompts; local-first. But many explanatory paragraphs and the ML Lab nav compete for attention. | Merch banner, ad slot, consent CMP. | Ad and identity storage, "Remove Ads", unlock toasts. | Calm and privacy are TypeForge's clearest **differentiator**, *provided* its own UI noise is removed. |

**Verdict.** On "choosing and keeping it", TypeForge currently loses to both competitors on entry, focus and repetition. Monkeytype wins on immediacy. Keybr wins on a visible, changing practice path. TypeForge can credibly win on a *calm, private, honest* daily practice. That requires a typing-first surface that chains repetitions like Keybr's lesson flow and shows practice state that changes as the user practises, without copying Keybr's curriculum or Monkeytype's look.

## 3. Is "no broad redesign" justified? (coordinator `msg_af8eaa9bb07a`)

**Challenge verdict: the PRD's boundary is too restrictive in one direction and correctly restrictive in another.**

### 3.1 Where the boundary is too restrictive: layout, information architecture and component hierarchy

My evidence shows that the core UI problems are structural:
- what is on screen while typing;
- where the active line sits;
- what the result page leads with;
- what Home is for a returning user.

Those problems cannot be fixed by local polish of today's layout. The practice page, the result, Home for returning users and the Progress summary need a **coherent redesign of layout and information architecture**. The PRD (§1 "no… broad redesign"; §6 "do not commission a theme replacement") should be amended to authorise a redesign of those four surfaces, judged by the UI-quality acceptance in §3.4.

### 3.2 Where the boundary is reasonable: identity and theme

Nothing in my evidence shows that the navy-and-teal identity, the type families or the dark theme cause a user problem. Contrast is strong (10–12:1 for core text), and calm is a differentiator against both competitors. My observed issue is **semantic overuse of teal**. The same teal currently marks all of these:
- typed-correct text;
- the timer;
- primary buttons;
- eyebrow labels;
- H1 accents;
- links;
- the focus ring;
- the "current" nav item.

As a result, teal no longer signals "this matters now" (`d04`, `d09`, `d15`). Refining colour *roles* is in scope. Replacing the theme is not evidence-driven. A light or alternative theme is a reversible later preference, not a fix.

### 3.3 Materially stronger direction worth prototyping

The "stronger direction" is **not** a new palette. It is a **practice-stage layout**:
- the passage is the largest object, placed at about the top third of the viewport;
- run chrome reduces to a mini timer and one restart affordance;
- a compact *practice state strip* sits above the stage, e.g. "Today: 2 blocks · 4 min · goal 5 min · focus: accuracy" or the current practice choice;
- after a block the result appears **in place**, with "Again" as the default and details expandable;
- Home for returning users *is* this stage.

Compare it with a *refined current layout*, meaning the same page structure with chrome trimmed. Use the same acceptance tests and a short human preference and comprehension check. Owen chooses at that prototype checkpoint, based on visual taste. Neither prototype should copy Monkeytype's yellow-on-grey or Keybr's keyboard-centric light layout.

### 3.4 UI quality acceptance beyond click counts

Each item is pass/fail on current-build screenshots unless marked otherwise.

| Area | Criterion | How to verify |
|---|---|---|
| Hierarchy | During a run at 1440×900 and 390×844, the active line is the highest-contrast, largest text on screen. At most two other elements are visible: a mini timer and a restart affordance, each with lower visual weight. | Screenshot review by Claude |
| Hierarchy | A five-second glance test is a **user test**, not a screenshot check: users can say what to do next. | User test |
| Stability | No layout shift while typing: help or warning text never reflows the stage. | Cumulative layout shift during a scripted run measured as 0 by `PerformanceObserver`; screenshot diff of the stage box before and after an error |
| Placement | The active line's top is at or above 40–45% of viewport height on load at both reference sizes. At 320 px and at real 200% browser zoom it is visible after focus without manual scroll. | Screenshots at each size |
| Typography | Passage ≥ 22 px monospace on desktop, ≥ 18 px at 390 px. No ordinary corpus word splits mid-word (subject to §5.4). Context lines remain visibly secondary but large text still meets ≥ 3:1. | Measurement plus screenshots |
| Colour roles | Teal reserved for "active and positive now": typed-correct, primary action, focus. A different neutral or weight for eyebrows and links. Typed vs untyped differ by more than hue (weight or underline). | Token audit listing each colour token and its single role |
| States | Every state has a designed screenshot with no unstyled or orphan elements (e.g. today's orphan "Pair" label): idle-focused, idle-unfocused, running, first error, corrected, paused or focus-lost, block complete in place, save failure, no history, insufficient evidence. | One screenshot per state |
| Consistency | One select, button and chip style. Spacing on a documented 8 px scale. No mixed font sizes inside a control row (`d04`). | Component inventory sheet |
| Motion | Any added transition is ≤ 150 ms, non-essential, and disabled under reduced motion. No celebratory animation during a run. | `getAnimations()` check under reduced-motion emulation |
| Feedback comprehension | **User test, not a screenshot.** After a block, users correctly state what they practised, how it went and what "Again" will do. | User test |

## 4. Corrections to my initial report

- **F9 overstated.** Practice sessions *are* listed in Progress's saved-session table (`d18`, `app.ts:683-695`). The real gap is the lack of a practice **activity or goal summary**. Practice data is not missing from storage or history. The PRD already reflects this correctly.
- **Monkeytype's first keypress.** My matrix said "the first keypress focuses the test". That is accurate only with a qualifier: the key was **absorbed, not entered as text** (`mt03`, where the active word was untouched). It is not an "accepted first character", and the comparison supports better entry and focus design only.
- **Hypotheses, not observations.** Physical-mobile on-screen-keyboard occlusion (F4) and screen-reader over-announcement of `<output>` updates (F10) remain hypotheses. Simulated viewports and aria snapshots show geometry and roles, not OS keyboard behaviour or what a screen reader actually says.
- **F1's printable-key capture is withdrawn as a default** (see §5.1).
- **F6's stable-target rendering is withdrawn as the default.** It is now a prototype that must pass the geometry checks (see §5.3).
- **F4's "break only at spaces" was underspecified.** It is a geometry proof obligation, not a CSS change (see §5.4 and the Architect's finding).

## 5. Challenge of the proposed fixes

### 5.1 Safe autofocus and focus recovery (P1 / AC1)

**Revised proposal.**
1. **Autofocus only on intentional entry into a typing context**, and only if `document.activeElement` is `body` or the stage itself. Intentional entry means arriving via Practice/Start/Again/Next, or loading the practice route directly. Never move focus away from a control the user chose.
2. **No global printable-key capture.** It conflicts with:
   - screen-reader browse mode, where single-letter quick-navigation keys go to the page;
   - IME composition;
   - modifier shortcuts and access keys;
   - typing into other fields.

   Keybr's practice of not refocusing on printable keys (K8) is consistent with this.
3. **Visible focus recovery as a real control.** When the typing input is not focused, the stage shows a dimmed state containing a focusable **button**, "Continue typing (Enter)". The button is in the tab order immediately after the settings summary.
   - Clicking anywhere on the stage, including blank space, focuses the input.
   - A document-level Enter listener applies **only** when the active element is `body`, there are no modifiers and no composition is in progress.
   - The button's accessible name states the action, and the state change is announced once through the existing status region.
4. **Starting the run.** The timer still starts on the first *accepted* text insertion, never on focus.

**Acceptance and falsification.** The proposal fails if any of these happen:
- a keystroke typed into, or a shortcut used on, the duration select, a checkbox, a link, a button or the textarea of another feature is consumed by the typing input or moves focus;
- a composition session (e.g. a synthetic `compositionstart` in a test, plus a **real IME check later**) inserts duplicate text;
- autofocus fires after the user has Tabbed to a control.

A manual NVDA or VoiceOver pass must confirm that letter quick-navigation still works when the page loads with focus on the input. If it does not, autofocus must be opt-in for AT users or limited to post-action entry (Again/Start). This is an unknown that only real AT testing can settle.

### 5.2 Repeat action without invalidating assessment (P3 / AC3)

**Practice results.** The primary action is **Again**, keyboard Enter while the result has focus, with focus placed on Again. It starts a *new* practice run with identical settings and a new ID, and immediately focuses the input (permitted by §5.1 as intentional entry).

**Recommended practice.** Again revalidates the recommendation and states visibly if it changed.

**Assessment results.** The primary action is **Practice next** (General or Recommended). "Retest with fresh passages" stays secondary and uses existing lineage and exclusion rules unchanged. *Never* offer "Again" on an assessment as a re-run of the same passages, and never let a repeat overwrite or merge results.

**Interruptions.** Practice may later offer an in-place pause. Assessment keeps today's interruption semantics, with only *visibility* added (focus-lost state shown in-viewport). That matches PRD AC3/§3 "Pause is not included in the first fix".

**Falsification.** The proposal fails if any of these happen:
- an assessment-origin comparison changes cohort or denominator;
- a repeat reuses an assessment's passages;
- the result page's primary key action fires while focus is on Export or Delete.

### 5.3 Error rendering vs native caret and selection geometry (P2 / AC2)

The Architect is right that the mirror shows the typed value plus the untyped target suffix (`app.ts:254-256`), while the textarea holds only the typed value. Any stable-target layer that does not occupy the same characters as the textarea breaks caret, selection and click geometry. A stable target is therefore **not the default**. Options, ranked:

**(a) Default: keep the current per-position mirror.** Add a **non-flow annotation**: an absolutely positioned "expected: e" glyph or tooltip anchored to the first mismatch. It uses `position:absolute` and `pointer-events:none`, so it takes no inline space and does not affect wrapping. Also:
- render extra characters with a distinct "extra" style, since they really are in the field;
- move the correction text out of `#typing-help`, which removes the reflow.

This needs no change to the geometry contract. The open question is visual: does a floating annotation read clearly at 390 px?

**(b) Prototype only:** stable target with extras as overlays. Adopt it only if the existing native selection, caret, middle-insertion, Ctrl+Backspace and wrap tests all pass unchanged.

**(c) Rejected:** Keybr's stop-on-error (K3). It changes scoring and the free native-editing contract, and it is a product decision, not a rendering fix.

**Acceptance.** For any input, the expected character at the first mismatch is visible within 1 line-height of the caret. No text-flow change occurs between error and correction. Every native editing test passes unchanged.

### 5.4 Word-safe wrapping is a geometry proof obligation (Architect `msg_8025f1616905`)

`word-break: break-all` (`style.css:132`) is not only an aesthetic flaw; it is *why* mirror and textarea wrap identically. Each wraps at an exact column regardless of where words end. With word-safe wrapping:
- the mirror would move a partially typed word, e.g. "th|rough", to the next line;
- the native textarea, which contains only "th", would keep it on the current line;
- caret, selection and click positions would then disagree.

Candidate solutions:

| Option | Mechanism | Pros | Cons and risk | Verdict |
|---|---|---|---|---|
| W1: keep break-all, reduce how often it triggers | Fit each passage on a single line where possible: responsive font size and passage max length per width tier, e.g. one line at ≥ 600 px. Wrap only on narrow tiers. | No geometry change at desktop. Corpus sentences mostly fit one line at 1440 px today (`d09`). | Still splits words at 390/320 px. Small fonts on phones. | Ship first at desktop. |
| W2: single-line horizontal "tape" for the active passage on narrow widths | Mirror and textarea both `white-space:pre`, no wrapping. Scroll the active line horizontally to keep the caret in a fixed reading zone, with `scrollLeft` synced between them. Previous and next passages remain as context lines. | Geometry stays exact (no wrapping at all). Word-safe by construction. Long reading-ahead within the line. | Horizontal scroll sync and clipping; selection dragging beyond the edge; RTL out of scope. Needs new tests for scroll sync, selection drag, click mapping and Ctrl+Backspace at the scroll edge. | **Recommended prototype** for ≤ 600 px. |
| W3: hidden input with a custom renderer (Keybr and Monkeytype style; Keybr's textarea is 1em×1em inside a zero-size container) | Text layout fully owned by the renderer, with word-level `nowrap` blocks. | Full layout freedom. | Native selection, mouse caret placement and native editing semantics would have to be re-implemented. That contradicts `DESIGN.md` "native editing over custom editors" and the engine's edit-reconstruction contract. | Reject for now. Revisit only if W1 and W2 both fail user tests. |
| W4: compute word-boundary line breaks from the target and force them into the textarea | Not possible: the textarea value must equal the typed text. | — | Infeasible. | Reject. |

**Proof obligations for any chosen option** (add to test-spec V2):
- partial word at the line edge;
- an extra character at the line edge;
- click into the middle of a wrapped or scrolled line;
- Shift+Arrow selection across a wrap or scroll boundary;
- Ctrl+Backspace at a boundary;
- caret position after passage commit.

Each case is checked against the native `selectionStart`/`selectionEnd` and mirror markers at 1440, 390 and 320 px.

### 5.5 Plausible benefit of the PRD stages for UI, UX and return value

| PRD item | Plausible UX and return benefit | Useful without ML? | What remains a hypothesis |
|---|---|---|---|
| P1 preferences and focus | Removes setup before each repetition; matches what both competitors do on return. | Yes | Whether it increases return frequency |
| P2 run layout and feedback | Comfortable reading-ahead; errors understood in place; calmer screen. | Yes | Comfort and enjoyment ratings |
| P3 repeat and lineage | Chains repetitions as Keybr's lesson flow does, while keeping TypeForge's honest assessment boundary. | Yes | Session length per visit |
| P4 reflection and activity | Visible practice state ("what I did today") that changes after each block, which provides the "personalisation feeling" without inventing a weakness. | Yes | Comprehension and motivation |
| P5/P6 practice profile and dose | Suggestions that actually respond to practice; targeted labels that are mechanically true. | Needs the ML and learning contract | Usefulness of the suggestion; learning effect |
| P7 ML comparison | Technical substance tied to a user decision. | — | Decision quality, then learning |

**Conclusion.** Essentially all of the near-term adoption value (P1–P4 plus the visual track in §3.4) is **independent of ML**. P5/P6 add *responsiveness*, which is the honest version of Keybr's visible adaptivity, but only after their contracts exist.

## 6. Polished general practice vs a guided daily loop

| Option | Experience | Strength | Weakness | Recommendation |
|---|---|---|---|---|
| **G1: polished general-practice foundation** | Remembered settings, focused stage, in-place result, "Again", a practice-activity strip, honest Progress summary. | Directly fixes every observed adoption failure. Low risk. Useful to experienced typists who just want reps. Needs no new learning claims. | No visible "path" of the kind Keybr provides. | **Build first.** It is the foundation in every scenario. |
| **G2: guided daily loop** ("Today": warm-up, then one focus block, then reflect) | One daily CTA and a short sequence with a visible daily goal and next step, using the learning lane's mechanism and General as fallback. | Gives a reason to return and a sense of a path. Uses analysis honestly. | Depends on the P5/P6 contracts. Prescriptive sequences can annoy quick-test users. Cold start needs a sensible default. | **Add as an optional mode on top of G1** once P5/P6 contracts exist. Free practice remains one keystroke away. |

**Reversible defaults** (recommended without asking Owen):

| Setting | Default | Note |
|---|---|---|
| Duration | 30 s | Remembered once chosen |
| Live WPM | Off during runs | The timer is shown; this is a preference |
| Daily goal | Off until the user sets one | No streaks by default; the activity strip is descriptive |
| ML Lab | Moves to footer and "About the model" links | In-flow "Why this?" links on any suggestion |
| Physical QWERTY declaration | Asked once in first-run setup and remembered | Never inferred |
| Mobile | Responsive viewing and progress | Typing allowed, but no claim of mobile or IME support until a device test |

## 7. Problem → fix → benefit → risk → acceptance/falsification

The last column says what evidence is needed: **A** = automated or scripted browser check, **S** = Claude screenshot review, **U** = human user test, **D** = physical device or assistive-technology test.

| Observed problem (evidence) | Proposed fix | Expected benefit (label) | Risk | Acceptance / falsification | Evidence needed |
|---|---|---|---|---|---|
| No focus on entry; blank stage not clickable (`d04`, `d16`, F1) | §5.1 contextual autofocus, whole-stage click, Enter-to-continue button | Faster start (mechanical); smoother return (hypothesis) | Stealing keys from AT, IME or controls | 0 interactions to first accepted key on intentional entry. Fails if any control key or shortcut is consumed, or if AT quick-nav breaks. | A + D (screen reader, IME) |
| Settings forgotten every visit (`r02`, F3) | Versioned local preferences with precedence: URL, then origin, then remembered, then default | Fewer steps per visit (mechanical) | Fabricated QWERTY declaration; contaminated lineage | Reload keeps explicit choices. Fails if an invalid URL value silently inherits a preference, or QWERTY is set without user action. | A |
| Practice result pushes assessment with "deleted" copy (`d10`, F2) | §5.2 Again as primary for practice; truthful origin states | Repetition becomes the default (mechanical); longer sessions (hypothesis) | Accidental assessment re-runs | Again repeats identical settings with a new ID. No "deleted" copy without a real deletion. Fails if a repeat reuses assessment passages. | A + S |
| Run chrome and off-screen warnings (`d09`, `p04`, F5) | Practice-stage layout (§3.3); warnings next to the active line | Calmer focus (hypothesis); warnings noticed (mechanical) | Hiding useful info | Run-time visible set ≤ stage, timer and restart. Warnings in viewport within 120 px of the line. Zero layout shift. | A + S |
| Mid-word breaks and low active line on narrow widths (`m05`, `s-320`, F4) | W1 at desktop, W2 tape prototype at narrow widths (§5.4) | Readable look-ahead (hypothesis) | Caret, selection or click geometry mismatch | Proof cases in §5.4 pass at 1440/390/320. Fails on any mirror vs native divergence. | A + S; D for OS keyboard occlusion |
| Extra letters hide the expected text (`p03`, F6) | §5.3a non-flow expected-glyph annotation | Errors understood in place (hypothesis) | Visual clutter at small sizes | The expected character is visible near the caret. No flow change. Native tests unchanged. | A + S + U (comprehension) |
| Jargon results: internal IDs, single-observation "slowest" pairs (`d15`, F8) | Lead with metrics, one takeaway and Again; details behind a disclosure; minimum counts | Results understood (hypothesis) | Reviewers lose detail | Above-fold check. Fails if any internal version ID appears outside the disclosure, or a pair is ranked below the minimum count. | S + U |
| No practice summary (`d18`, F9 corrected) | Practice activity strip and a Progress section (PRD AC4) | Visible continuity (hypothesis) | Gamification pressure | Totals equal the saved practice records; deletion recomputes. Fails on mixing practice WPM into the assessment trend. | A + U |
| Possible screen-reader chatter from `<output>` updates (F10, hypothesis) | Non-live metrics plus milestone announcements | Usable with AT (hypothesis) | Losing needed info | Real screen reader announces at milestones only. | D |
| Teal overuse and flat hierarchy (`d04`, `d15`) | Colour-role refactor (§3.4) within the existing identity | Clearer "what matters now" (hypothesis) | Inconsistency during migration | Token audit with one role per token. Typed vs untyped differ by a non-hue cue. | S |
| No visible practice path, compared with Keybr K2/K5 | Practice-state strip now; G2 "Today" loop later | Reason to return (hypothesis) | Overpromising adaptivity | Strip states only observed facts. Any suggestion carries "why" and support counts. | S + U |
| Mobile clipping is a competitor failure (K11); TypeForge does not overflow | Keep TypeForge responsive; treat it as a differentiator | Usable on small screens (mechanical) | Implying mobile typing support | No horizontal overflow at 320 and up. No "mobile supported" claim without device tests. | A; D for claims |

**Needs human users, not screenshots:** enjoyment and comfort, comprehension of results and suggestions, perceived personalisation, return intention and behaviour, whether a "Today" loop helps or annoys, the visual-direction preference, and any learning benefit (the learning lane's evaluation).

## 8. Decisions for Owen

Owen has already chosen daily practice and an emphasis on UI/UX. Everything in §5–§6 is a reversible default, not a question. Only these remain:

1. **Audience scope** (merges the learning lane's audience question with my mobile and beginner questions). Is the first product **keyboard-familiar adults doing copy practice on a physical keyboard** (recommended; Keybr already owns the beginner touch-typing curriculum), or should TypeForge also become a beginner course and/or a mobile typing product? This changes content, layout priorities and claims.
2. **Visual direction checkpoint** (later, not now). After the two §3.3 prototypes exist and pass the §3.4 acceptance, pick the refined current layout or the practice-stage layout, using the prototypes and a small preference and comprehension check.

The learning lane's study-capacity and product-promise questions remain theirs and are untouched here.

## 9. Challenge verdict and actionable revisions to the PRD and test spec

**Verdict.** The PRD's problem decomposition and sequencing (A as the foundation of B, ML deferred) are sound and supported by both competitor comparisons. **Approve with revisions:**

1. **Amend scope (PRD §1, §6).** Authorise a coherent *layout and information-architecture redesign* of the practice stage, in-place result, returning Home and the Progress summary. Theme replacement stays out of scope without evidence. Add an explicit **visual and interaction quality track**, using §3.4 as acceptance, owned by Claude, with two-prototype comparison at a checkpoint.
2. **AC1:** adopt §5.1 exactly. No printable-key capture. Enter-to-continue only when focus is on `body`. A visible focus-recovery button. AT quick-nav and IME checks listed as **D** gates.
3. **AC2:** replace "word-safe wrapping" with the §5.4 proof obligations and W1/W2 options. Default error rendering is §5.3a; stable-target rendering is prototype-only. Add the layout-shift = 0 criterion.
4. **AC3:** adopt §5.2, including no "Again" re-run for assessments and Practice next as the assessment primary action.
5. **AC4:** keep as written. It already reflects the F9 correction. Add "practice-state strip states only observed facts".
6. **Test spec V2/V4:** add the §5.4 boundary cases, the layout-shift measurement, the screenshot-per-state inventory, the token audit, and **U/D** evidence labels so that screenshots are never used to certify comprehension or AT behaviour.
7. **Competitor claims:** record Keybr as observed for the K1–K12 flows only. Its learning-efficacy claims are unmeasured marketing. Monkeytype's first key was absorbed. Neither competitor's untested accessibility, IME or mobile flows support a superiority claim in either direction.

## 10. Coverage gaps

- No human participants. No physical phone or IME. No screen reader. No Firefox or Safari. No real browser zoom.
- Keybr: settings persistence after a change, other lesson modes, the Typing Test page, accounts, high scores and a consent-regime variant were not exercised.
- Monkeytype: mobile typing and error close-ups were not exercised (prior round).
- I did not prototype any proposal. All visual directions are described, not rendered. Prototype screenshots are the next design-evidence step once implementation is authorised.
- The ML and engineering reports were not read, so this challenge does not reconcile with them.

## 11. Evidence manifest (`.omx/plans/typeforge-keybr-evidence/`)

| File | Shows |
|---|---|
| `k-recon-load.png`, `recon-aria.yml` | Recon first load (separate recon profile) |
| `k01-first-visit-tour-1440.png` | First visit, tour slide 1 |
| `k02-tour-slide-02…12.png` | Tour slides; text recorded in `keybr-log.json` |
| `k03-practice-idle-after-tour-1440.png` | Ready state |
| `k04-error-feedback-1440.png`, `k04b-error-feedback-zoom.png` | Wrong key did not advance |
| `k05-after-backspace-zoom.png` | After Backspace |
| `k06-lesson-running-1440.png` | Lesson running; error shown later in red |
| `k07-after-lesson-1-1440.png` | Next lesson with metric deltas |
| `k08-after-lesson-4-1440.png`, `k08b-…zoom.png` | Unlock and toasts |
| `k09-profile-after-4-lessons-1440.png`, `k09b-profile-full.png` | Profile and population histogram |
| `k10-settings-1440.png`, `k10b-settings-full.png` | Settings |
| `k11-focus-lost-1440.png` | Blur plus Enter-to-activate |
| `k12-returning-visit-1440.png` | Returning visit |
| `k13`, `k13b` (390) | Mobile first visit, overflow |
| `k14`, `k14b` (390) | Mobile after tour |
| `k15-mobile-typing-390.png` | Mobile typing with simulated keys |
| `k16-after-tabs-focus-visibility.png` | After 8 Tabs; focus stayed in the textarea |
| `aria-keybr-practice.yml` | Aria snapshot of the practice screen |
| `keybr-log.json` | All steps, timings, lesson text, metrics, storage key names and lengths |
| `harness/*.mjs` | Exact scripts. They need `playwright-core` outside the project and write only to this folder. |

TypeForge and Monkeytype references (`d*`, `p*`, `m*`, `s-*`, `mt*`) are from `docs/reviews/2026-11-15/design-evidence/`, captured earlier on 2026-11-15.
