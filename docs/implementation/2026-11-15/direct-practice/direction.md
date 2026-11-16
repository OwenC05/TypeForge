# Direct-practice redesign: reference-backed direction

15 November 2026. Author: actual Claude design lead. This is the settled direction for T4 (implementation). Per the brief, it is not a taste-approval gate. It was written before any UI code and before the target image.

## 1. Product truth this design serves

**Who and what.** A keyboard-familiar English copy typist opens TypeForge to practise for a few minutes, today and again tomorrow.

**The job of the screen.** Show text to type right away, make errors and corrections legible without breaking rhythm, then offer the next block with one key. Settings exist, but nobody has to visit them.

**What carries over unchanged:**
- Engine and scoring; native textarea ownership of caret, selection and composition; the response mirror.
- First-mismatch marker plus a geometry-decided caret pointer.
- A reserved feedback slot (integrity/Undo > hints; announce once).
- Honest save failure, lineage and abstention.
- No viewport-driven prompt choice.

## 2. Three concrete deficits

Observed in the baseline (`docs/reviews/2026-11-15/design-evidence/d0*`) and in rejected prototypes A (`tf-proto-a` @ `0ee69ec`) and B (`tf-proto-b` @ `5e763aa`).

| # | Deficit | Evidence |
|---|---|---|
| D1 | **Arrival is gated, and settings read as a form.** The baseline has a marketing hero. A adds a "Pick up where you left off" Home with chips, and B a first-run panel. All three show settings as labelled `<select>`s, a checkbox and text like "keyboard not declared". | baseline `d01`; A `1440-s13`; B `1440-s11`, `1440-s13` |
| D2 | **Generic dark-dashboard material with no voice.** A navy page holds a teal-outlined box that looks like a form field floating in emptiness. The text is system sans with a default monospace and tiny grey labels. At 1440×900 about half the viewport is empty below a bordered card. Nothing about it says "instrument" or "craft". | A `1440-s01`/`s03`; B `1440-s13`/`s04` |
| D3 | **Completion reads as a report, and the error cue is weak.** A switches to a results page of metric cards and tables. B shows a small grey panel. The expected-glyph tag is about 11 px, a space renders as an unreadable blob, and `l`/`1` are ambiguous. | A `1440-s09`, `390-s04`; B `1440-s04`, `1440-s09` |

## 3. References: what each contributed and what was rejected

**Tools.** No Awwwards or Uizze MCP is connected; `ToolSearch` found nothing and `~/.awwwards-mcp/` does not exist. These are public pages and live captures taken on 2026-11-15 with playwright-core and Chrome 157 headless. Files are in `research/captures/` with JSON metadata (URL, final URL, HTTP status, viewport, time). Scripts: `research/cap.mjs`, `research/aw.mjs`. Only the 1440×900 viewport was kept, except for Monolog, where a full page was also captured and inspected.

| Ref | Source | Question it answers | Adopted | Rejected |
|---|---|---|---|---|
| R1 **Monolog** | Awwwards **Site of the Day, 6 Jul 2026** (`awwwards.com/sites/monolog` → `bymonolog.com`); `captures/monolog-1440.png` sha256 `ffa97016…` | Material and type voice (treatment) | A warm off-white **paper** ground; **ink** as the dominant colour; a heavy, tightly tracked grotesk for the few large numerals; small **uppercase monospace micro-labels** ("CLIENT WINS • 2026") for metadata; solid ink buttons | The marketing hero, display headlines, photography, animated grain, preloader and scroll choreography (latency and noise in a typing tool) |
| R2 **iA Writer** | `ia.net/writer` (not an Awwwards listing; strongest product match for "the text is the interface"); `captures/ia-writer-1440.png` sha256 `d98e4f51…` | How an instrument for text uses hierarchy (purpose) | **Focus semantics**: finished text recedes, current text is full ink, the **caret is the only accent**. A generous monospace measure and line-height. No chrome around the text block. | The download hero and the shadowed card frame |
| R3 **Teenage Engineering OP-1** | `teenage.engineering/products/op-1`; `captures/teenage-engineering-1440.png` sha256 `14447bc2…` | Controls as part of the instrument (treatment) | **Keys, not form fields**: the duration and mode choices look like a short row of physical keys on the same warm material, with the pressed state shown by fill. Lowercase labels. **One** strong signal colour used sparingly. | Product photography, 3D and decorative line icons |
| R4 **Monkeytype** | earlier evidence `docs/reviews/2026-11-15/design-evidence/mt04-15s-idle-1440.png`, `mt05`, `mt06` (Monkeytype v26.43.0, observed 2026-11-15); a fresh live capture today was blocked by consent dialogs | Immediacy and quiet configuration | Text ready on load. **Configuration is a single quiet row of the actual options**, with the selected value highlighted, so the controls are the state. Restart hint as small keycaps. | Yellow-on-grey identity, random word salad, toolbar icon soup, the ad/merch banner |
| R5 **Keybr** | `.omx/plans/typeforge-keybr-evidence/k03`, `k04`, `k06` | Understandable evolving practice | A small observed-facts line about today's practice | Stop-on-error, the multicoloured keyboard heat map, dense metrics header, observed mobile clipping |

Awwwards typography-winners listing (`captures/awwwards-typography-winners.png`, 31 site links, 64 items) was used to find R1. "I'm Not a Bot" (Honorable Mention) was inspected and discarded: the capture shows only a preloader poster. No motion was borrowed, so no motion study was needed, and no new decorative motion is added.

## 4. Direction: "Paper and ink"

The text you type is **ink filling a page**. Untyped text sits in graphite and turns to full ink as you type it correctly. The caret is the only cobalt mark on the page, and an error is the only vermilion. Everything else is paper, rules and small monospace labels. The controls are a short row of keys on the paper, not a form.

### 4.1 Architecture (no gate)

- `/` **is** practice: ready General 30 s on a clean first visit, and remembered valid choices on return. The same surface serves `practice.html?mode=practice…` deep links. Assessment stays its own entry (`practice.html`, which is an assessment) with its own defaults.
- **No** hero, onboarding, setup panel, keyboard declaration prompt or "welcome back" page. The first-visit and returning layouts are identical; returning users only see their remembered key states.
- Progress and Lab remain secondary pages and get the same material, a lighter pass.
- The result appears **in place** on the same page and in the same column. **Again** is a focused real button, so Enter repeats.

### 4.2 Page skeleton at 1440×900 (top to bottom)

1. **Top bar** (56 px; 1px rule below):
   - Left: the wordmark `typeforge` in lowercase ink grotesk, about 17 px, with a small ink square mark (`t_`).
   - Right: text links `practice · assessment · progress · lab` (14 px; current page underlined in ink).
   - During a run the bar fades to 30% opacity, with no layout change.
2. **Control rail** (about 40 px, aligned to the text column, about 40 px above the timer):
   - `[15][30][60][120] s`: duration keys.
   - A thin divider, then `[general][pair ▾][suggested]`: practice kind. "suggested" is disabled with a reason popover when the policy abstains. "pair ▾" opens a popover list of supported pairs.
   - A thin divider, then a `qwerty` toggle key.
   - The selected key is filled ink with paper text. Unselected keys are raised paper with a 1px edge at ≥ 3:1.
   - ui-sdk components carry all of this behaviour (T1's notes). No `<select>` dropdowns are shown.
3. **Run line**, the stage header (aligned to the text column):
   - Left: a large **countdown** numeral in heavy grotesk, about 72 px, ink, showing `30` until the first insertion.
   - Right of it, on its baseline: a monospace micro-label `GENERAL PRACTICE · 30 S` (12 px, letterspaced, muted).
   - Far right: `why?`, a quiet link that is active in ready/result. During a run it is disabled and visibly dimmed.
4. **Text column**. The measure is about 60–64 characters, max about 960 px, left-aligned, horizontally centred in the viewport. There is no box or border; the page is the paper.
   - Previous committed line: monospace 22 px, context grey, keeping static vermilion error underlines.
   - **Active passage: monospace 34 px, line-height 1.55.** Typed-correct text is ink; untyped text is graphite. The caret is a 2px cobalt bar. Wrong characters are vermilion with a wavy underline.
   - The expected-glyph tag sits **above** the first mismatch: 14 px mono, vermilion fill, paper text, with a space shown as `␣` and a font that separates `l` and `1`. The geometry-decided caret pointer sits below the caret in the same style: `↶ earlier error · expected e`.
   - Next passage: monospace 22 px, context grey.
   - Placement: the active line's top sits at about 36–40% of the viewport (≤ 45%).
5. **Feedback slot**: fixed height, directly under the column, monospace 14 px. Integrity/Undo messages have a 3px vermilion left tick; hints are muted. It is empty but keeps its space when quiet.
6. **Foot row** (column-aligned):
   - Left: tiny keycap hints `space` next passage · `backspace` fix · `tab` `enter` restart.
   - Right: **restart**, a raised paper key.
   - Hidden during a run, apart from the restart key.
7. A quiet bottom line, `results stay in this browser`, in a 12 px mono micro-label, ready state only.

### 4.3 States

| State | Design |
|---|---|
| Ready, focused | As above. Slot: muted "start typing — the clock starts with your first letter". |
| Ready, unfocused | Same layout. A centred ink key **continue typing ↵** appears over the column, and the passage dims to 60%. |
| Running | Top bar at 30%, control rail and foot hints hidden with `visibility:hidden` (space kept), countdown in ink. Only the countdown, text, slot and restart key are fully visible. |
| Error | Vermilion glyph with underline, plus the expected tag above it. The pointer appears only off-line or off-stage. |
| Corrected | Tag and pointer clear. |
| Focus lost / integrity | **continue typing ↵** key over the column, plus a slot message with the vermilion tick: "Focus left the text — this run is flagged and excluded from headline progress." |
| Undo | Slot: "Undo isn't scored: this run will be saved without accuracy and excluded from progress. Restart to keep scoring." |
| Complete, practice | The column area becomes the **result**: <br>• heavy grotesk numerals `64` `wpm` and `97.8%` `accuracy` (96/64 px), with an observed line in 18 px sans ("Most first-attempt misses: e→r (3 of 41)");<br>• the ink **Again ↵** key focused, with "same settings, new sentences";<br>• a quiet `details` disclosure;<br>• `saved in this browser` as a mono micro-label.<br>An observed-facts line, `today · 3 blocks · 1 min 30 s recorded · Europe/London`, appears above the result only. |
| Complete, assessment | Same layout, with **Practice next ↵** primary and *retest with fresh passages* secondary. Never "Again". |
| Save failure | The result keeps its numbers, and the save line becomes a vermilion-ticked slot message with **retry** and **export** keys. |
| Empty history / first visit | Identical to ready. The today line is absent; nothing is invented. |
| Insufficient evidence | "suggested" key disabled; its popover says "Not enough evidence for a focus yet — using general." No "Suggested" label anywhere. |
| Progress page | Same paper and type. An observed activity line, an assessment trend card and a session list as a ruled table in mono figures. |

### 4.4 Type

- **Passage:** a monospace with clearly distinct `l 1 I` and `0 O`, and calm proportions. Preferred: a self-hosted, **OFL-licensed** variable or two-weight woff2 (e.g. JetBrains Mono or IBM Plex Mono), Latin subset only. The license file, source URL, version and sha256 are recorded, and bytes are measured. Fallback stack: `ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, monospace`. No remote font loading at runtime. If licensing or bytes are unclear, use the fallback and record it.
- **Display numerals** (countdown, result): system grotesk at weight 750–800 with tracking −0.02em: `"Segoe UI Variable Display", "SF Pro Display", "Helvetica Neue", Arial, system-ui`. Use tabular numerals for the countdown.
- **UI text:** the same system grotesk at 400/500, 14–16 px.
- **Micro-labels:** the passage monospace at 11–12 px, uppercase, letterspacing 0.08em.
- **Scale:** 12 / 14 / 16 / 18 / 22 / 34 (passage) / 72 (countdown) / 96 (result). At 390 the passage is 20 px, the countdown 48 px and the result 64 px. At 320 the passage is 18 px.

### 4.5 Palette roles

Contrast values were computed (WCAG ratio, on paper `#F3F0E8`).

| Token | Hex | Single role | Contrast on paper |
|---|---|---|---|
| `--paper` | `#F3F0E8` | page ground | — |
| `--paper-raised` | `#E9E5DB` | unselected keys, popovers | — |
| `--ink` | `#17160F` | typed-correct text, headings, selected-key fill, primary key | 15.9 |
| `--graphite` | `#6F6A5F` | untyped passage text | 4.7 |
| `--muted` | `#5E5A51` | UI secondary text, micro-labels | 6.0 |
| `--context` | `#8C877B` | previous/next passage, only at ≥ 22 px | 3.1 (large text only; below 22 px use `--graphite`) |
| `--edge` | `#8C877B` | key and control edges | 3.1 |
| `--rule` | `#D5D0C4` | decorative hairlines only, never a control boundary | 1.35 |
| `--cobalt` | `#2440C8` | caret, focus ring, the one live indicator | 7.0 |
| `--vermilion` | `#C2410C` | wrong glyphs, expected tag fill, integrity tick | 4.6 |
| `--vermilion-deep` | `#A3360A` | small error text | 6.0 |

**Colour is never the only signal:**
- errors also get a wavy underline and the tag;
- the selected key also gets a fill change;
- focus also gets a 2px offset ring;
- typed vs untyped text differ in luminance only (ink vs graphite, ratio 3.4). That is the clarified geometry-safe exception: weight changes alter advance widths.

**Theme scope.** A single light theme is designed and verified. A dark variant is out of scope rather than half-built. The navy/teal identity in `DESIGN.md` is superseded by this user-directed redesign, and `DESIGN.md` is updated in T4.

### 4.6 Spacing, shape, motion

- **Spacing:** 4/8 px grid; 8, 12, 16, 24, 32, 48, 64.
- **Column:** max 960 px; side gutter 16 px at ≤ 390.
- **Shape:**
  - keys: radius 6 px, 1px `--edge`, with a 0 1px 0 `--edge` bottom shadow to suggest a key; the pressed or selected key is ink-filled with no shadow;
  - popovers: radius 8 px, `--paper-raised`, 1px `--edge`, a small soft shadow;
  - no cards or boxes around the text.
- **Material:** optional static paper grain at ≤ 3% opacity from a tiny inline SVG noise, never animated, removable if it costs paint time.
- **Motion:**
  - opacity-only fades of 120 ms for the top bar during a run and for result swap-in;
  - no transforms on the text;
  - nothing under `prefers-reduced-motion`.

### 4.7 Responsive

- **390×844:**
  - top bar: wordmark plus a compact `menu` disclosure (ui-sdk popover/menu) for the four links;
  - control rail on one line, scrolling horizontally inside its own row with edge fade and no page scroll, or wrapping to two rows; choose whichever keeps all keys ≥ 40 px tall and visible without clipping;
  - countdown 48 px; passage 20 px; active line ≤ 45%.
- **320:** the passage is 18 px. The rail wraps to two rows. The active line stays visible on focus without manual scroll.
- **Real 200% browser zoom** uses the Chrome profile `default_zoom_level` method from prototype A.

### 4.8 Wrapping

Word-safe wrapping is attempted only as geometry-tested presentation. B's column snapping (CSS `round()`), which made the mirror and textarea agree across a 141-width sweep, is the starting mechanism; reuse it via a reviewed diff. Then test whether `overflow-wrap: normal; word-break: normal` with snapped columns keeps native caret/selection agreement for partial words and extra characters at line edges. If any case fails, keep `break-all` and record the failure. The wrap outcome is never claimed without the matrix.

## 5. Explicit departures from references

- No marketing hero, no preloader, no scroll story, no photography (R1, R3).
- No dark theme (R4) and no keyboard heat map (R5).
- No stop-on-error (R5).
- No icon toolbar (R4).
- No live WPM during a run (existing decision).
- No streaks, goals or "level" language.
- Weight is never used to mark typed text, because it would break monospace geometry with the mirror.

## 6. Target images requested from root

Root will generate these, because this host has no authorized image tool. Targets are saved to `docs/implementation/2026-11-15/direct-practice/target/`. Actual dimensions are recorded after inspection.

1. `target-1440-running.png`: 1440×900, running with one error.
2. `target-1440-result.png`: 1440×900, practice block complete in place.
3. `target-390-ready.png`: 390×844, ready state on first visit.

Every number in a target is an **illustrative fixture** and is labelled as such in the evidence. It is never presented as user data.
