# ET-1 recovery contract — final Claude decision

Recorded by root from actual Claude design lead messages `msg_c9eaab76075c` and `msg_6d202c0c84d7` on 16 November 2026. These supersede the interim `msg_9938eb5e4547` sessionStorage proposal and the older statement that all assessment continuation is immediate. T4's `msg_24756a7ce108` describes that superseded proposal, not the final decision. No user approval gate is added.

## Agreed behavior

- Keep completed results that are pending or failed to save in a document-scoped, ordered in-memory collection. Preserve each immutable payload and its own save state; never overwrite an older unsaved result. Existing IndexedDB result persistence and export remain unchanged in scope. **No sessionStorage/localStorage mirror, new response persistence or router.**
- Same-page Again and result-setting continuation proceed immediately. Retain recovery in the reserved notice slot, with Retry save, Export and explicit Discard. Updates during typing must not steal focus or move the passage. Multiple entries remain recoverable; pending/out-of-order save outcomes update the matching record. Preserve per-result single-flight and existing permanent-validation/stale-operation guards.
- Navigation to another document through assessment Practice next, retest or other in-app links holds when unsaved results remain. Show the lead's in-place message, `N results not saved. Leaving this page loses them.`, focus Export after that deliberate navigation attempt, and offer the explicit **Leave without saving** action. Do not infer discard from an ordinary second click on an unchanged navigation label.
- If no unsaved result remains, navigation is immediate. If a pending save settles while the departure notice is displayed, update the state consistently; do not use stale counts or silently lose another entry.
- No beforeunload prompt. Tab close, reload and document destruction/BFCache reload are documented limitations; do not claim the in-memory collection survives them.

## Required evidence before closure

ET-1 remains open until a fix commit and regression/browser evidence cover failed and pending saves before/after Again, result settings, multiple consecutive results, overlapping saves settling in either order, single-flight retry, permanent rejection, both assessment continuation links, general in-app departure, empty-list immediate navigation, explicit discard, and settlement during the departure notice. Final actual-Claude state/interaction review covers the recovery slot at 1440, 390 and 320. Independent technical review must cover the final source delta; the frozen `2101314` review does not accept this implementation.

T4 remains the sole source owner. If intermediate mirror code exists in its current dirty work, it should remove only its own superseded changes and verify the final diff contains no new response mirror. Other agents must not edit that worktree. ET-2 prediction-freeze repair and its separate acceptance checks remain required.
