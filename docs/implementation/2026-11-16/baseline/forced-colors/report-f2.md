# Forced-colors repair: F-2, typed and untyped passage text

Extension authorised by P2 (`msg_1188d943708d`) after F-1 (`73a81c6`, evidence `58740b5`).

## Change (source commit `aa5887d`, `typing-app/client/src/style.css` only)

The rules below are colour-only. They were added inside the existing `@media (forced-colors: active)` block, exactly as proposed:

| part | rule |
|---|---|
| (a) untyped | `.typing-surface .prompt { forced-color-adjust: none; color: GrayText }` |
| (b) typed | `.prompt .correct { color: CanvasText }` |
| (c) wrong | `.prompt .wrong { color: CanvasText; text-decoration-color: CanvasText }` (wavy underline kept) |
| (d) selection | `.prompt .selected { background: Highlight; color: HighlightText }` |
| (e) mirror caret | `.stage[data-focus=in] .prompt .cursor::before { border-left-color: Highlight }` |
| (f) mismatch tag | `.prompt .first-mismatch::after { background: CanvasText; color: Canvas }` |
| (g) caret-side pointer | `.prompt .cursor[data-pointer]::after { background: Canvas; color: CanvasText; border-color: CanvasText }` |

These were not touched: font, weight, size, letter-spacing, line-height, padding, border widths, white-space, word-break, `::selection`, the textarea, `.passage-context`, and anything outside the media block.

## Verification

- `npm run check`: exit 0, **132/132 tests pass**, and typecheck and build pass (`check-f2.log`). Build assets: `app-D_HEScZ5.css`, `app-C9cAkf09.js`.
- Script: `f2-capture.cjs`. It ran Chrome 157.0.8103.52 and Edge 157.0.4341.60 headless at 1440×900 and 390×844, with a seeded prompt and a paused clock. The before build is F-1 (`73a81c6`, preview PID 52740) and the after build is F-2 (preview PID 55780). Each preview was stopped by PID. The same keystroke script ran with forced colors on and off. It covered these states:
  - `typed`: a typed prefix and the untyped remainder, with the caret.
  - `mismatch`: one mismatch with its expected-glyph tag.
  - `corrected`: Backspace, then the right glyph.
  - `selection`: Shift+ArrowLeft ×4 inside the active passage.
  - `pointer`: an earlier mismatch and the caret-side pointer. The pointer appears only at 390; at 1440 the passage fits on one line, so the mismatch never leaves the caret line.
  - `committed`: the passage is finished and Space advances it.
  - `cover`: Tab leaves the textarea and "continue typing" shows.
- Computed values after F-2, identical in all 4 browser×viewport runs (`f2-compare.json`, `styles`), with before values for comparison. In the before build, typed and untyped text are both CanvasText, so they look the same.

  | part | after |
  |---|---|
  | untyped | `rgb(96,0,0)` (GrayText) |
  | typed / corrected | `rgb(0,0,0)` (CanvasText) |
  | wrong | `rgb(0,0,0)` with a wavy underline in `rgb(0,0,0)` |
  | selected | `rgb(255,255,255)` on `rgb(55,0,110)` |
  | mirror caret | 3px solid `rgb(55,0,110)` |
  | mismatch tag | `rgb(255,255,255)` on `rgb(0,0,0)` |
  | pointer | `rgb(0,0,0)` on `rgb(255,255,255)`, 1px border `rgb(0,0,0)` |

  Font, weight, size and line-height match those of the normal theme.
- Visual check of `f2-after/*-forced-*.png`:
  - Typed text is black and untyped text is GrayText. It is clearly legible: the emulated GrayText reaches about 13:1 on Canvas.
  - The mismatch tag is a filled black box with a white glyph. Before the change it had collapsed to a bare glyph.
  - The selection is a filled Highlight box, and the pointer reads as a bordered label.
  - The mirror caret shows at the caret position, and the cover appears when focus leaves.
- **Zero geometry change.** 84 of 84 comparisons are equal. The data compared is every mirror span rect, the textarea selection and rect, the surface scrollTop, and the native textarea hit-test offset at the mirror cursor. It was compared for forced on versus off, in both builds, and for the normal theme before versus after, across 7 states, 2 browsers and 2 viewports.
- **Normal theme unchanged.** 28 of 28 normal-theme screenshots are byte-identical before and after (sha256).

The capture list with sha256 is in `captures-f2.md`.

## Observations, not caused by F-2 (identical before and after, forced and normal)

- In the `cover` state, the native hit-test at the cursor lands on the cover button text, so it returns `node:#text`.
- In the 390 `pointer` state, the caret sits at index 32, exactly on a soft wrap. Native hit-testing at the mirror cursor returns offset 0. The native textarea caret, which forced colors make black, is drawn at the end of line 1, while the mirror caret is drawn at the start of line 2. Both builds and both themes show this.
- The textarea's own text is forced to CanvasText (the textarea is unchanged, by rule). It overprints the typed mirror glyphs in the same colour, so it does not reduce the distinction.

## F-2b: context lines (P2 review finding; source commit `55728f6`)

P2 found that the aria-hidden context lines (`#previous-prompt`, `#next-prompt`, `.passage-context`) still rendered in CanvasText. That is the same colour as typed text, so the upcoming passage looked as if it had already been typed. I added two colour-only rules inside the same forced-colors block, with no `forced-color-adjust` and no metrics: `.passage-context { color: GrayText }` and `.passage-context .missed { text-decoration-color: CanvasText }`.

- `npm run check`: exit 0, 132/132 tests pass, and typecheck and build pass (`check-f2b.log`). Build assets: `app-BPASI-5n.css`, `app-C9cAkf09.js` became `app-C0hnm0Lw.js`. The JS changes only because it references the CSS hash.
- I re-ran `f2-capture.cjs f2b-after` (output in `f2-f2b-after/`; preview PID 30896, stopped by PID). It covers Chrome and Edge at 1440 and 390, every state including `mismatch` and `committed`. I then ran `node f2-compare.cjs f2-after f2-f2b-after f2b-compare.json` against the F-2 build.
  - Under forced colors, the previous and next context lines go from `rgb(0,0,0)` (CanvasText) to `rgb(96,0,0)` (GrayText). That matches the untyped remainder in all 4 runs.
  - The `.missed` underline is `underline wavy rgb(0,0,0)`.
  - Font metrics are unchanged: 25.6px/40.96px at 1440 and 16px/25.6px at 390.
- **Zero geometry change.** 84 of 84 comparisons are equal (mirror spans, textarea selection and hit-test offset, scrollTop), forced on versus off, in both builds.
- **Normal theme unchanged.** 28 of 28 normal-theme screenshots are byte-identical between F-2 and F-2b. All 28 forced screenshots changed, as intended.
- Visual check (`f2-f2b-after/*-forced-committed.png`, `*-forced-mismatch.png`): only the typed prefix of the active line is black. The committed and upcoming lines read as GrayText, and the missed-run underline is black.
- The capture list with sha256 is in `captures-f2b.md`. Two small changes to the scripts: `f2-capture.cjs` gained the `f2b-after` label and now records `nextContext` and `missed` styles, and `f2-compare.cjs` now takes its two directories and output file as arguments. Earlier outputs are unaffected.

## Limits

- **Hue more than luminance (observed by P2).** In the emulated palette, GrayText is a dark maroon `rgb(96,0,0)` against CanvasText black `rgb(0,0,0)`. The typed/untyped distinction therefore relies on hue more than on lightness. That is acceptable because both are system colours, but no real Windows high-contrast theme was tested, and there the GrayText/CanvasText pair is whatever the theme defines.
- The forced colors are Chromium emulation (`forcedColors: 'active'`, default light palette). This was not tested on a real Windows contrast theme or on dark palettes, where GrayText legibility depends on the theme.
- No screen reader was used, and only headless Chrome and Edge were tested.
