# Forced-colors repair: F-1, selected state on the rail

Task `task_54d6b18c2091` (helper of P2). Branch `OwenC05/tf-forced-colors`, based on `852f7ef` (`c65460b` plus one docs-only commit).

## Change (source commit `73a81c6`, `typing-app/client/src/style.css` only)

One new `@media (forced-colors: active)` block, placed before the reduced-motion block. Nothing outside it changed.

- `ui-segmented-control-item[data-checked]`, `ui-switch.key[data-checked]`: `forced-color-adjust: none; background: Highlight; color: HighlightText; border-color: Highlight; box-shadow: none`.
- `ui-segmented-control-item[data-disabled]`: `color: GrayText; border-color: GrayText; border-style: dashed`.
- `…[data-checked]:focus-visible`: `outline: 2px solid CanvasText; outline-offset: 2px`. **Why this was added:** the first after-capture (without this rule) showed that `forced-color-adjust: none` also unforces the outline. The ring on a checked key rendered as the page's hard-coded cobalt `rgb(36, 64, 200)` and not as a system colour. It was visible on the emulated light palette. On a dark high-contrast theme, though, cobalt on a black Canvas is about 2.6:1, and the brief requires system colours only. With the rule, the computed ring is `rgb(0, 0, 0)` (CanvasText), 2px solid, offset 2px. Unchecked keys keep the forced default focus ring (Highlight).

## Verification

1. `npm ci && npm run check` in `typing-app/client`: exit 0, **132 tests, 132 pass, 0 fail**, and typecheck and build pass (`check-f1.log`). Build assets: `app-CtAXeEln.css`, `app-DeMnTvxf.js`. Before the change they were `app-ChsJ1aui.css` and `app-BNPI8kHH.js`. The JS hash changes only because it references the CSS asset.
2. Browsers: playwright-core 1.65.1 installed in a scratch folder outside the repo. System Chrome 157.0.8103.52 and Edge 157.0.4341.60, headless. Served with `vite preview --host 127.0.0.1 --port 5313 --strictPort`, hidden. The build PIDs were 59476 (before), 54532 (first after) and 52740 (final after). Each was stopped by PID after its command line was checked. Script: `capture.cjs` (seeded `Math.random`, fixed paused clock, reduced motion).
3. Forced colors (`forcedColors: 'active'`, `matchMedia` confirmed true) at 1440×900 and 390×844, in both browsers. Captures: ready (30 s + general), after clicking `15` and `pair`, with qwerty on, and with Tab focus on a checked key.

   | state | before (checked / unchecked) | after: checked | after: unchecked | after: disabled `suggested` |
   |---|---|---|---|---|
   | background | `rgb(255,255,255)` / `rgb(255,255,255)` | `rgb(55,0,110)` (Highlight) | `rgb(255,255,255)` | transparent |
   | color | `rgb(0,0,0)` / `rgb(0,0,0)` | `rgb(255,255,255)` (HighlightText) | `rgb(0,0,0)` | `rgb(96,0,0)` (GrayText) |
   | border | `rgb(0,0,0)` / `rgb(0,0,0)` | `rgb(55,0,110)` solid | `rgb(0,0,0)` solid | `rgb(96,0,0)` dashed |

   The values are identical in all 4 browser×viewport runs (`after/evidence.json`, `steps.*.rail`). Visual check (`after/*-forced-*.png`): the checked `15`/`30`, `general`/`pair` and `qwerty` keys are filled. Unchecked keys are outlined, and `suggested` is dashed in GrayText. Before (`before/*-forced-*.png`), every key looks the same.
4. Semantics unchanged. `data-checked` and `aria-checked` follow the selection (30→15, general→pair, qwerty false→true) both before and after. A forced click on the disabled `suggested` leaves it at `data-checked` false, `aria-checked="false"`, `tabIndex -1`, not focused. Tab order: the nav links, then `15`* (checked, `:focus-visible`), then `pair`* (it skips the disabled `suggested`), then the pair select, then `qwerty`*. Focus stays visible on every stop.
5. Normal theme (no forced colors) at 1440 and 390, both browsers. The ready and running screenshots are **byte-identical** before and after (8/8 sha256 match). Active-line top and rail height are identical: 1440 → 338.953 px / 36 px; 390 → 320.594 px / 90 px, in both ready and running states. Active-line top is the top of the cursor glyph, or of the first glyph when idle.

The capture list with sha256 is in `captures-f1.md`.

## Limits

- Forced colors are emulated through Chromium's `forcedColors: 'active'` with its default light palette (Highlight `rgb(55,0,110)`, GrayText `rgb(96,0,0)`). This was not tested on a real Windows contrast theme or a dark theme.
- No screen reader was used. Semantics were checked only through attributes and focus.
- Headless Chrome and Edge only. No Firefox.
