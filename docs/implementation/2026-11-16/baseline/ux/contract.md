# Baseline and Suggested: UX state and transition contract (P2)

16 November 2026 · actual Claude (`claude-opus-5-5`, requested effort high) · Task `task_15d7fb65c018`, Dispatch `ctx_188d78feb5e3`.

> **r2, 18 November 2026** (Task `task_8e97696fc3b6`): revised after the independent actual-Claude critique `05a6767` (root import `8337569`) and reconciled with P1 r1 `747d3e7`. Root selected option A, so the ten-test gate ships with the reviewed automatic pilot. [revision-r2.md](revision-r2.md) maps each finding to its fix, and [finite-plan-end.md](finite-plan-end.md) covers the finite Suggested plan. The REVISE verdict stays open until an independent delta review.

This is a proposal for root to reconcile with P1's policy at `e484754`, now r1 `747d3e7` (`.omx/specs/typeforge-practice-policy-v1.md`). Production app, style and `DESIGN.md` are untouched by this lane. The F-1/F-2 forced-colours repair is a separate, independently accepted change; see `forced-colors-acceptance.md`.

## 1. The promise, in one sentence

> **Ten 30-second assessments let TypeForge look for a key pair worth practising. It may find one, or it may tell you nothing stands out. Either way, General practice is always there.**

This promise is shown **only when the shipped config enables reviewed automatic coaching** (`automaticCoaching: 'enabled'`). Under a disabled config (a defensive state only, not a release target), the baseline is framed as *10 short baseline tests give a steady picture of your typing*. Suggested reads *isn’t switched on in this version*, and no copy advertises an unlock or claims a gate ran.

The count is about participation. It is never a level, a score or a confidence. Finishing ten tests never guarantees a suggestion. Under P1's gates, many people (slow or error-prone typists especially, see P1 `coverage-report.md`) will finish with **no focus**. The UI treats that as a normal, complete outcome.

## 2. Smallest extension of the accepted interface

There is no new page, landing, onboarding, modal or global key handler. `/` stays focused, ready, General 30 s on a clean first visit, and is **pixel-identical to the accepted first visit**. The 0-of-10 state adds nothing visible. The baseline lives in five existing places:

| Where | What is added | Why there |
|---|---|---|
| Rail `suggested` key (`/`) | Still dashed while locked. Now **keyboard-reachable**: `aria-disabled="true"` plus a cancelled `valuechange`, replacing `disabled`. A press explains in the slot. r2: **no tally** (dropped on the independent review's recommendation); progress lives in why?, results and Progress. | It is where personalisation already lives. Today's `disabled` item cannot be focused, so keyboard users never learn why it is off. |
| `why?` panel | A baseline block on top: an `ui-progress` "n of 10 tests" bar, what counts, what doesn't, and where the count comes from. In Suggested mode: why this pair and the limits of the rule. | The existing explanation surface. The current panel text is jargon ("No compatible eligible assessment timing history") and is replaced. |
| Assessment page (`practice.html`) | The run label reads `Baseline test n of 10 · 30 s` when the run would count. Otherwise it reads `Assessment · d s` with a one-line slot hint saying why not. | A baseline test **is** an assessment (P1). No new mode. |
| In-place assessment result | A baseline block under the observation: progress, a counted / not-counted / waiting-to-save line, and baseline-aware actions. At test 10 it shows *Baseline complete.* then **Last 10 tests · median**, with figures one step below the hero. A failed save makes **retry saving** the focused primary. | Results already appear in place, and Enter continues. |
| Progress page | A "Baseline" section: one count, the **Last 10 tests · median** summary with date range and update note (its persistent home), one provenance sentence, **take test n →**, and **start a new baseline** with an inline confirm. | Reset is rare and deliberate, so it belongs off the typing surface. |

Duration, qwerty and kind keys never lock because of the baseline. A non-qualifying setting produces an honest label and hint, never a blocked control.

## 3. UI read interface (to P1/P3, matching P1 §Output)

```ts
type BaselineState = 'checking' | 'not-started' | 'in-progress' | 'pending'
                   | 'complete-ready' | 'complete-insufficient' | 'unavailable';
interface BaselineStatus {
  policyId: string; configId: string;
  target: 10;                         // display only; never hard-code 10 in copy
  counted: number;                    // 0..10; a lower bound when !baselineProofComplete
  baselineProofComplete: boolean;     // capped-milestone proof. false => "at least n", no ordinal
  evidenceScanComplete: boolean|null; // null => coaching not requested (disabled scope), not a failure
  pendingSave: number;                // completed here, not durably saved yet (saving or failed+retryable); never counted
  automaticCoaching: 'enabled'|'disabled'; // REQUEST: from config releaseScope.automaticCoachingEnabled
  state: BaselineState; reason: Reason | null;   // Reason: P1 r1 union incl. coaching-deferred, source-integrity
  focus?: { pair; pairGeometricMs; referenceGeometricMs; observations;
            referenceObservations; sourceRuns; promptContexts; wordContexts };
  summary: { summaryState: 'available'|'pending'|'unavailable'|'not-complete';
             summarySelectionProofComplete: boolean;   // newest-ten ordering proof, separate from baselineProofComplete
             medianWpm: number|null; medianAccuracy: number|null; validAccuracySources: number;
             timeRange: { from: string; to: string } } | null;
  witnessIds: string[]; sourceRevision: number;
  // otherContextCount: reserved null by P1 r1; the UI never reads or renders it (C5).
}
```

`checking` is UI-only (the read has not returned). It shows **no number**, so the count never flickers to 0. Everything else is P1's enum. The UI derives nothing statistical itself. Reason handling is exhaustive (`copy.ts` `reasons`, `reasonText: Record<Reason | 'unknown', string>`). An unrecognised reason renders *Suggested is unavailable right now.*, never `undefined`. **A gate reason is presented only if a gate ran**: coaching must be enabled and `evidenceScanComplete === true`. Otherwise the copy is `coaching-deferred` (disabled) or `scan-incomplete` (scan not complete).

## 4. States, surfaces and copy (copy deck is `prototype/copy.ts`)

| State (reason) | Rail `suggested` | Slot on press (≤ 75 chars + action, fits 320) | `why?` baseline block | Primary action where it applies |
|---|---|---|---|---|
| `checking` | dashed | Checking saved tests… | Checking saved tests… | — |
| `not-started` | dashed (first visit unchanged) | Suggested needs 10 baseline tests · 0 done. [take test 1 →] | progress 0 of 10; what counts; about five minutes **of typing** at your own pace | — |
| `in-progress` 1–9 | dashed | … · 4 done. [take test 5 →] | same, n of 10 | result: **next test ↵**, practise |
| `pending` (`scan-incomplete`), < 10 | dashed | At least 7 of 10 found; some results couldn’t be read. [check again] | "at least" count + read note; [take a baseline test →] (**no ordinal**) | — |
| `pending` (`scan-incomplete`), proof = 10 | dashed | Baseline done; recent timing couldn’t all be read. [check again] | complete; "Using general until it can be read." | — |
| `complete-ready` | **ordinary key** (not checked unless chosen) | n/a | pair, ms vs ms, observations, words, runs; rule-of-thumb limit | final result: **try suggested · th ↵**, general |
| `complete-insufficient` (`stale-evidence`) | dashed | Baseline done; its timing is over 30 days old. [take an assessment →] | milestone kept; only timing needs refreshing | — |
| `complete-insufficient` (gate reason, gate ran) | dashed | Baseline done; Suggested has no focus for now. More in why? | one plain reason + General/pair alternative | final result: summary, reason, **practise general ↵**, another assessment |
| `complete-insufficient` (`coaching-deferred`, defensive) | dashed | Suggested isn’t switched on in this version. General works as usual. | "Baseline complete." + deferred sentence; **no** re-check sentence | final result: summary, deferred sentence, **practise general ↵** |
| any, coaching disabled, < 10 (defensive) | dashed | Suggested isn’t switched on in this version. General works as usual. | "10 short baseline tests give a steady picture of your typing…" (no Suggested promise) | as in-progress |
| `unavailable` (`policy-invalid`, `storage-unavailable`, `context-unavailable`, `source-integrity`, unknown) | dashed, **no number** | Suggested needs results saved in this browser; saving is off here. / Saved tests can’t be counted right now. General works as usual. / Suggested is unavailable here. General works as usual. | reason + "General and pair practice work as usual." | — |

One sentence per reason code (`reasonText` in `copy.ts`). None says failed, level, weak, wrong or behind:

| Reason | Copy |
|---|---|
| `too-few-observations-for-any-pair` | No key pair has come up often enough in finished sentences yet to compare fairly. |
| `insufficient-context-diversity` | The slower pairs so far came from too few different words to be sure. |
| `unstable-evidence` | One pair looked slower, but not consistently across your earlier and later runs. |
| `no-effect` | No key pair stands out clearly from the rest. |
| `corpus-coverage` | The pair that stood out appears in too few practice sentences to build a focused block. |
| `exposure-unsupported` | There aren’t enough practice sentences with that pair to give it real practice in one block. |
| `stale-evidence` | Your baseline is complete, but its timing is more than 30 days old. A fresh 30-second assessment or two lets Suggested look again. |
| `coaching-deferred` | Suggested practice isn’t switched on in this version. General and pair practice work as usual. |
| `policy-invalid` | Suggested is unavailable in this version of TypeForge. |
| `storage-unavailable` | Suggested needs results saved in this browser, and saving isn’t available here (a private window can do this). |
| `context-unavailable` | The baseline record in this browser couldn’t be read, so tests aren’t being counted right now. |
| `source-integrity` | Some saved results couldn’t be checked, so tests aren’t being counted right now. |
| `scan-incomplete` | Not every saved result could be read just now, so this may be incomplete. |
| unknown (defensive) | Suggested is unavailable right now. |

Every insufficient outcome **from a gate that ran** ends with: *General practice fits best for now, and pair practice lets you pick a pair yourself. Suggested re-checks after each saved 30-second run.* That sentence states what happens next without asking the person to keep testing (P1 §41). It is never shown after `coaching-deferred`, because no re-check happens there.

**Rolling summary (r2, review finding 2).** The label is **Last 10 tests · median**, never "your baseline". It shows the WPM and accuracy medians as figures one step below the result hero, directly under *Baseline complete.*, with the date range and *Updates as you take more 30-second tests. Practice doesn’t change it.* Its persistent home is Progress. States:
- available with both proofs: figures.
- `medianAccuracy` null: WPM only, plus *Accuracy isn’t available for all 10, so only speed is shown.*
- an eleventh save pending: the previous ten, plus *Updating after your latest test is saved.*
- `pending`, or `summarySelectionProofComplete` false: *Last 10 tests · median: your latest tests are still being read.* No numbers.
- unavailable, `not-complete`, below ten, after deletion or after reset: no line, and never a cached median.

The capped-milestone proof can say *Baseline complete.* while the summary is still being read.

**QWERTY declaration (r2, finding 3).** The assessment hint with qwerty off reads *Baseline tests need QWERTY.* and offers **[my keyboard is qwerty]**. That key is the user's own press of the existing switch. The not-counted result carries the same key. The first visit is unchanged.

Explanation of a focus (`focusExplanation`): *In your recent runs, th took longer than your other key pairs: 212 ms against 168 ms, across 46 clean th transitions in 7 different words and 10 runs.* followed by *A rule of thumb from your own timings, not a diagnosis or a proven training method. It re-checks before every block and may change focus or step back to general.* The numbers come from P1 fields; the prototype uses simulated fixtures.

## 5. Transitions

```
            first visit /  ──(always)──▶  General ready (unchanged)
                 │ press locked suggested / why? / nav assessment
                 ▼
 assessment ready ── label "Baseline test n of 10" iff 30 s ∧ qwerty ∧ counting
    │ first key (native textarea; no interception)
    ▼
 running ── focus lost / Undo / safety ──▶ result: "Not counted … nothing is taken away"  [try test n again ↵]
    │ 30 s elapse (≥1 accepted insertion)
    ▼
 result in place ── saving (pending segment) ──┬─ saved: counted = n  ─┬─ n<10: [next test ↵] → assessment ready n+1 (focus in textarea)
                                               │                      └─ n=10: complete-ready [try suggested ↵] → / Suggested ready
                                               │                                complete-insufficient [practise general ↵] → / General ready
                                               └─ save failed: "Not saved yet, so it doesn’t count." [retry saving ↵] focused, next test secondary;
                                                  continuing keeps it pending + recoverable (ready slot / next result: "Test n isn’t saved yet… [retry saving]")
 / ready (later visit) ── next preparation recomputes ──▶ unchanged | focus changed (slot: "Suggested now leans on er …")
                                                       | stepped back (slot: "Suggested stepped back to general: th no longer stands out clearly …")
                                                       (both only with an in-memory prior snapshot; otherwise the current reason, no previous pair)
 Progress ▸ start a new baseline ▸ [keep current baseline] (focused) | [start over] → epoch reset, 0 of 10, results kept
 Source deletion ▸ count re-derived at next read (may drop 10 → 9; Suggested locks again; why? always explains the count comes from saved tests)
```

Rules the implementation must keep:

1. **Counting only after durable save.** A pending segment shows in graphite (an outlined segment under forced colours) with "· 1 waiting to save". A failed save never increments. It stays pending and recoverable after the person continues. **retry saving** is the focused primary on its own result; elsewhere it is offered without taking focus.
2. **Nothing subtracts except deletion, reset or context change.** A flagged or too-short run says *not counted*, never *lost*.
3. **Change, retire and unlock evaluate at preparation only** (P1 confirmed). A running block never changes label, text or focus. A late read **or late save** refreshes only safe surfaces. Before the first key that means the label, slot, rail and `why?`. During a run it means only the hidden `why?`. On a result it means that result's block and save row. It never touches the active snapshot (frozen at the first key) or moves focus out of the text. Enter on *next test* before the save resolves keeps the pending result (r2, finding 5).
4. **Ordinals use `counted + pendingSave + 1`**, and only when `baselineProofComplete` is true. With a lower bound, at the cap, or while checking or unavailable, no ordinal is printed (*Baseline test · 30 s*, *take a baseline test →*). If a pending save is finally lost (reload), the next label reuses the number. That is honest, and the unsaved line has already said why.
5. **Remembered kind is respected** (corrected in delta r2.1, root `64a53b4`, adopted by P1 r2 `c6a8a80`). Unlock never auto-selects Suggested on `/`. Only the final result's explicit *try suggested* does. A change or step-back is explained **only by comparing against the previous admitted new-coach snapshot held in memory in this document**. In that case the slot says once *Suggested now leans on er…* or *Suggested stepped back to general: th…*. After a reload or a navigation (each page is a new document), or when no prior snapshot exists, no previous pair is named. A remembered Suggested with no focus gives a General block and *Suggested has no focus for now, so this block is general. More in why?*. A remembered Suggested whose focus changed is simply ready as *Suggested practice · er · 30 s*. The legacy saved `practiceFocus` belongs to the old selector and is **never** used, and no decision history is persisted for this copy.
6. **Focus.** `/` and the assessment page keep the native textarea focused on load. A locked-key press keeps focus on the key, and the accepted "start typing ↵" cover handles return. Results focus their primary key, and Enter acts only on that focused key. Reset confirm focuses the safe choice. After reset, focus goes to the section heading (`tabindex=-1`) and the status is announced via `role=status`.
7. **The pilot is exactly 30 s with declared QWERTY** (delta r2.1). The person's settings are never clamped and nothing is blocked. If Suggested is chosen at another duration or with qwerty off, the block is General and its label says so (*General practice · 60 s*). The slot says *Suggested runs at 30 s only; this block is general.* [use 30 s], or *Suggested needs QWERTY; this is general.* [my keyboard is qwerty]. Each key is the person's own press of the existing control. why? explains the rule, and no focus evidence is presented for a block that does not use it. General and pair are unaffected at every duration.

## 6. Reconciliation with P1 `e484754`, and challenges

Adopted 1:1: 10 × 30 s flow-v1 assessments with explicit QWERTY in one bucket; a test counts after durable save with ≥ 1 accepted insertion and no integrity flags, with no accuracy or clean floor; count capped at 10 with no age expiry; freshness only on target evidence; non-destructive epoch reset; witness-derived counts; `baselineProofComplete` / `evidenceScanComplete`; `pending/scan-incomplete`; the ordered reason precedence; no suggestion before ten; retire/switch at preparation.

**Challenges and proposals for root:**

- **C1 (r2: policy adopted in P1 r1; presentation per review finding 2, see §4 "Rolling summary").** Original text: **The completed experience under-delivers "personalisation" unless completion is worth something on its own.** P1's coverage probe shows that ten tests at slow speeds can yield zero clean timing, and even an ideal 60 WPM run supports about one pair. So *complete-insufficient* is probably the common ending. **Proposal:** the final result shows a descriptive **baseline summary** (median WPM and accuracy of the ten witness tests; claim 2, descriptive only). Completion then always gives the person something true about their typing. Prototyped in states 11/12/27 and marked as a proposal. It needs root/P1 to define the statistic and its witness set.
- **C2 — Keep the multi-context picker out of v1.** A user-visible "context" concept (switching keyboards or people) costs explanation and a picker, for a rare case that **start a new baseline** already covers ("someone else used this browser or you changed keyboards"). **Recommend:** v1 ships the default context plus epoch reset only, and the context schema can stay dormant. Decision/exposure provenance sidecars are invisible to the UI; the `why?` explanation needs only the current snapshot.
- **C3 — Exposure honesty on Suggested results.** P1 requires dose facts. If exposure instrumentation lands, the Suggested result adds one line: *th came up 14 times in this block*, with `too-short-to-evaluate` / `partial-context` worded as *too short to say how much th you practised*. If it doesn't land, the result makes **no dose claim**. Never show planned dose.
- **C4 — One accepted key counts as a test.** I accept this: participation is deliberately weak, and the copy never implies quality. It does make the counter cheap, which is another reason C1 matters.
- **C5 — Hidden counter check.** (r2: the leftover `otherContextCount` sentence on Progress is removed.) There is exactly one visible counter (tests). The 20-run/30-day coach window is **not** shown as a second counter. It surfaces only as a reason sentence ("recent runs", "over 30 days old"), so no second number appears to the person.
- **C6 — `context-unavailable` wording.** Today the qwerty switch defaults off on a clean visit. A baseline test therefore needs one explicit qwerty press, explained by the assessment-page hint. That is honest but adds friction to test 1. Defaulting qwerty on would be a policy change (P1 forbids inferring the declaration), so it is not proposed. **r2:** the independent review measured the cost (test 1 could be spent). The fix is one explicit declaration key, a user action, never inferred (§4).

## 7. Not in this contract

Undo/Redo, metric changes, the selector itself, error-focused coaching, beginner curriculum, accounts, sync, deployment, and any claim that practice improves typing.
