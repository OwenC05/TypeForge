# Pair-timing eligibility, metric version 2

**Admit intervals only from a submitted, verifiable, first-pass exact copy.** None of the 36 tested exclusion windows established equivalent timing in corrected sentences across the required groups. One error or edit therefore disqualifies the whole sentence, including correct intervals before and after it. The same rule applies at every speed. [Development evidence](../analysis/eligibility-v2-report.md)

## Neutral contract

One trial has a nonempty `target`, its recorded `final` input, an ordered `events` array, and Boolean `submitted` and `qwerty` (both default to true in the synthetic fixtures). Start with an empty buffer, a collapsed caret at its end, and no previous key. Compare text exactly, including case, spaces and punctuation. Index characters from zero by Unicode code point. Browser adapters must translate DOM UTF-16 offsets if they support supplementary characters.

1. Require a submitted sentence and a supported layout. An unfinished sentence contributes zero intervals even when the visible text equals the target. A nonempty target and a recorded final string are required.
2. Every event carries a finite, nonnegative, binary64 time `t` in milliseconds. The neutral stream must be chronological. Shift may tie with another event. All non-Shift times must increase strictly, including at word boundaries. A missing, tied non-Shift, reversed or invalid time discards the sentence.
3. Ignore `shift` after validating its time. It adds no text, produces no pair and does not break a pair. An `insert` is a proved physical single-character append at the tail. Use the actual character, including its case. It must be a printable Unicode character (exclude General Categories C and Z except ASCII space). Reject a repeat-marked non-Shift event. Repeated letters from distinct physical presses, such as the two o's in *book*, are valid.
4. A tracked `deleteBackward` removes the last character if present. It marks the sentence edited even on an empty buffer. An insertion that disagrees with the target, including an extra character, marks an error. These marks survive later typing and deletion. A `deleteWordBackward`, `deleteForward`, `replaceSelection`, `moveCursor` or non-Shift `modifier` disqualifies the sentence. An unsupported, untracked, multi-character or composing mutation also disqualifies it. Movement away and back and replacing a selection with identical text still count.
5. Close the sentence at submission. The replayed buffer must equal the recorded final input. The final input must equal the target, every insertion must have been correct on its first attempt at that target position, and the sentence must have passed the gates above. Discard all provisional intervals on failure.
6. For adjacent target positions `i-1` and `i`, require two consecutive non-Shift inserts of ASCII lowercase `a` through `z`. Emit the original pair, `fromIndex = i-1`, `toIndex = i` and the difference between the two physical press times if **0 < ms ≤ 5,000**. Preserve fractions. A longer pause drops that pair only. The next press can start a new interval. There is no interval to the first key, from the last key to the delimiter, or across sentences.

Both letters lie in the same contiguous ASCII-letter word. An uppercase character, space, digit, punctuation mark or apostrophe breaks adjacency. In `aBcd can't we’re` the pairs are `cd`, `ca`, `an`, `we` and `re`. Keep overlapping pairs at distinct positions in event order.

The Python entry point is `eligible(replay(target, events, final, ...))`. The output contains `intervals` and a sentence-level `reason`. A verified clean sentence with no qualifying pair has an empty array and a null reason. Whole-sentence rejections have an empty array and one of `unfinished`, `unsupported-layout`, `invalid-trial`, `invalid-time`, `repeat`, `unsupported-edit`, `untracked-input`, `final-mismatch` or `clean-copy-required`. The source adapter checks its inputs before neutral replay. In neutral replay, check submission, layout, target/final types, then events in order (time first), then the final buffer and finally the clean-copy gate. [Synthetic contract cases](../fixtures/eligibility-v2.json)

## Aalto adapter

Use `eligible(replay_aalto(rows, layout=..., keyboard_type=...))` on a single participant's single submitted test section. Require metadata `LAYOUT=qwerty` and `KEYBOARD_TYPE` equal to `full` or `laptop`. The pinned development reader verifies file hashes, TSV structure, participant identity and the readability of numeric fields before grouping.

- Require at least one row. Every row must agree on `PARTICIPANT_ID`, `TEST_SECTION_ID`, `SENTENCE` and `USER_INPUT`. Require finite nonnegative `PRESS_TIME`, an integer `KEYCODE` and a unique integer `KEYSTROKE_ID` within the trial. Order rows by numeric `(PRESS_TIME, KEYSTROKE_ID)`. Use press times alone for intervals.
- Map code 16 to Shift and 8 to one tail Backspace, regardless of the display name. Codes 17, 18, 20, 91–93 and 224 are modifiers. Codes 33–40, 45 and 46 are navigation or editing controls. Either group disqualifies the sentence.
- Accept the recorded `LETTER` as insertion text for codes 32, 48–57, 59, 61, 65–90, 96–111, 173, 186–192, 219–222 and 226. Apply the printable single-character check above. All other codes, key names in place of text, dead keys and unmatched controls disqualify the sentence. The whitelist identifies physical keys. Text always comes from the recorded character.
- `USER_INPUT` is the recorded submitted text. Compare it with the entire replay before emitting any pair. Aalto has no reliable selection ranges, word-deletion, focus, composition or hardware-repeat flags. A coincidentally matching final string does not rehabilitate an unsupported control. Physical auto-repeat cannot be distinguished from separate presses in these logs.

The reference copies the press/ID ordering, lowercase pair test and pause cap from the existing Python audit without importing pipeline internals.

## TypeForge browser adapter for B2

The current app captures `performance.now()`, repeat state and selection at keydown. Its `beforeinput`/ `input` reconciliation verifies a splice against the old and new value. A fallback text diff is untracked. The engine records first attempts in `seenPositions`, counts per target key, and accumulates candidate keydown intervals. The following mapping is specified for B2 and has only synthetic conformance evidence. [Input reconciliation](../../typing-app/client/src/app.ts) · [Engine and session results](../../typing-app/client/src/engine.ts)

| Browser evidence | Neutral event or outcome |
| --- | --- |
| One matched printable keydown and verified `insertText` at a collapsed tail caret | Append the literal character at the physical keydown time. Preserve repeat. The current app also has a keydown-snapshot fallback when `beforeinput` is absent. Require the captured range, text and resulting value to verify the same append. |
| Shift with no text mutation of its own | `shift`. A shifted character is a separate literal insertion. |
| Native `deleteContentBackward` with a collapsed caret at the tail | `deleteBackward` for one character or a no-op at zero. Recognize a physical Backspace that produced no input event. |
| Native word/forward deletion or a noncollapsed range | `deleteWordBackward`, `deleteForward` or `replaceSelection`, even if the deleted range can be reconstructed. |
| Cursor navigation, a user selection, or a non-tail caret | `moveCursor`. Capture this even if the user returns to the end before typing. Ordinary caret advance caused by an accepted append is part of that append. |
| Ctrl, Alt, Meta, Caps Lock or a shortcut while collecting | `modifier`. The current printable-key filter alone cannot surface intervening non-text keys. |
| IME, paste/drop mutation, history undo/redo, autocomplete, unmatched key, divergent value, unknown edit or interruption | Invalidate the sentence, represented by `untracked`. Use the existing run-level integrity and progress gates as well. An unexplained or prevented intervening key other than Shift cannot connect two timed letters. |
| Missing/invalid press time or a time later than the input callback | Reject the sentence. Never substitute the input callback time for a printable press. |
| Verified submission or tracked flow-closing Space | Compare the committed response to the target. The closing action lies outside the text stream. A repeat or untracked closing action invalidates it. Reset all timing and attempt state for the next sentence. |

Use a confirmed QWERTY setting. The browser currently accepts lowercase ASCII and spaces in prompts. Punctuation and case fixtures exercise the shared scoring function. The app can keep per-sentence aggregates provisionally and discard them at closure. It need not persist raw keys, timestamps or editing traces. Both endpoints of an emitted pair are necessarily correct first attempts in an admitted sentence. A corrected key must never overwrite evidence of its original attempt.

## Version boundary

Write `metricVersion: 2` on new v2 records and tag derived training data and model artifacts with their metric version. Keep v1 records readable under their original definition. Never pool v1 and v2 counts, log sums, model histories, residuals, predictions, coach evidence, baseline membership or progress comparisons. Start a new baseline and personal history for v2. Use held-out v2 observations with a v2-trained expectation when evaluating a v2 model.
