# Forced-colours repair F-1 / F-2 / F-2b: actual-Claude acceptance receipt

16 November 2026 · P2 actual Claude (`claude-opus-5-5`, high). This is a separate scope from the baseline UX, authorised by root (`msg_5bbf536ea85f`, `msg_c8d9e57469ff`) as a narrow exception for the existing UI.

**Implementation:** an actual-Claude Orca helper. Task `task_54d6b18c2091` / Dispatch `ctx_95f517c16435` (F-1, F-2) and Task `task_5011a5f11623` / Dispatch `ctx_e31b8a565d58` (F-2b follow-up). Agent `claude`, requested model `claude-opus-5-5`, effort medium. Child worktree `tf-forced-colors`, based on `feature/daily-practice`. Single `style.css` writer.

| Item | Source commit | Evidence commit | Change (inside one `@media (forced-colors: active)` block) |
|---|---|---|---|
| F-1 selected state | `73a81c6` | `58740b5` | Checked segmented items and qwerty switch use Highlight/HighlightText (`forced-color-adjust:none`) with a CanvasText focus ring. Disabled item uses GrayText and keeps its dashed edge. |
| F-2 typed progress | `aa5887d` | `9a30071` | Colour only. Untyped text GrayText, typed CanvasText. Wrong glyph CanvasText with the wavy underline kept. Selection Highlight. Caret Highlight. Expected tag inverted; pointer Canvas/CanvasText. |
| F-2b context lines | `55728f6` | `27eb5f6` | Context lines GrayText, missed underline CanvasText. Requested by me after the F-2 review showed the upcoming line rendering like typed text. |

**My verification at `27eb5f6`:**

- `npm run check`: exit 0, 132/132 tests passed, 0 failed or skipped. Build `app-BPASI-5n.css` / `app-C0hnm0Lw.js`, identical to the helper's receipt.
- I inspected `after/*-forced-15-pair`, `*-focus-checked-key`, `f2-after/*-forced-mismatch`, `*-selection`, and `f2-f2b-after/msedge-390-forced-committed`. The selected-vs-unselected distinction holds. Typed vs untyped is distinct, and the mismatch, tag, selection, caret and cover remain visible.
- The helper's receipts show forced colours on vs off equal in 84/84 geometry comparisons and normal-theme captures byte-identical (8/8, 28/28, 28/28).

**Limits:**

- Chromium's emulated light forced palette only. No real Windows HC themes or dark palette.
- Edge 157.0.4341.60 really launched but rendered pixel-identical to Chrome.
- In this palette GrayText (dark maroon) vs CanvasText (black) separates mainly by hue.
- No screen reader or AT.
- A pre-existing 390 soft-wrap native-caret ambiguity is unchanged.
