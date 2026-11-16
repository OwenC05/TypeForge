# Baseline and Suggested: UX state and transition contract (P2)

16 November 2026 · actual Claude (`claude-opus-5-5`, requested effort high) · Task `task_15d7fb65c018`, Dispatch `ctx_188d78feb5e3`.

This is a proposal for root to reconcile with P1's policy at `e484754` (`.omx/specs/typeforge-practice-policy-v1.md`). Production app, style and `DESIGN.md` are untouched by this lane. The F-1/F-2 forced-colours repair is a separate, independently accepted change; see `forced-colors-acceptance.md`.

## 1. The promise, in one sentence

> **Ten 30-second assessments let TypeForge look for a key pair worth practising. It may find one, or it may tell you nothing stands out. Either way, General practice is always there.**

The count is about participation. It is never a level, a score or a confidence. Finishing ten tests never guarantees a suggestion. Under P1's gates, many people (slow or error-prone typists especially, see P1 `coverage-report.md`) will finish with **no focus**. The UI treats that as a normal, complete outcome.

## 2. Smallest extension of the accepted interface

There is no new page, landing, onboarding, modal or global key handler. `/` stays focused, ready, General 30 s on a clean first visit, and is **pixel-identical to the accepted first visit**. The 0-of-10 state adds nothing visible. The baseline lives in five existing places:

| Where | What is added | Why there |
|---|---|---|
| Rail `suggested` key (`/`) | Still dashed while locked. Now **keyboard-reachable**: `aria-disabled="true"` plus a cancelled `valuechange`, replacing `disabled`. A press explains in the slot. From 1 to 9 a hairline 10-segment tally sits inside the key's bottom edge (aria-hidden, zero layout cost). | It is where personalisation already lives. Today's `disabled` item cannot be focused, so keyboard users never learn why it is off. |
| `why?` panel | A baseline block on top: an `ui-progress` "n of 10 tests" bar, what counts, what doesn't, and where the count comes from. In Suggested mode: why this pair and the limits of the rule. | The existing explanation surface. The current panel text is jargon ("No compatible eligible assessment timing history") and is replaced. |
| Assessment page (`practice.html`) | The run label reads `Baseline test n of 10 · 30 s` when the run would count. Otherwise it reads `Assessment · d s` with a one-line slot hint saying why not. | A baseline test **is** an assessment (P1). No new mode. |
| In-place assessment result | A baseline block under the observation: progress, a counted / not-counted / waiting-to-save line, and baseline-aware actions. | Results already appear in place, and Enter continues. |
| Progress page | A "Baseline" section: count, provenance sentence, and **start a new baseline** with an inline confirm. | Reset is rare and deliberate, so it belongs off the typing surface. |

Duration, qwerty and kind keys never lock because of the baseline. A non-qualifying setting produces an honest label and hint, never a blocked control.

## 3. UI read interface (to P1/P3, matching P1 §Output)

```ts
type BaselineState = 'checking' | 'not-started' | 'in-progress' | 'pending'
                   | 'complete-ready' | 'complete-insufficient' | 'unavailable';
interface BaselineStatus {
  policyId: string; configId: string;
  target: 10;                       // display only; never hard-code 10 in copy
  counted: number;                  // 0..10; a lower bound when !baselineProofComplete
  baselineProofComplete: boolean;   // false => UI says "at least n"
  evidenceScanComplete: boolean;
  pendingSave: number;              // completed, not yet durably saved; never counted
  otherContextCount: number | null; // null => say nothing about other settings
  state: BaselineState; reason: Reason | null;
  focus?: { pair; pairGeometricMs; referenceGeometricMs; observations;
            referenceObservations; sourceRuns; promptContexts; wordContexts };
  witnessIds: string[]; sourceRevision: number;
}
```

`checking` is UI-only (the read has not returned). It shows **no tally and no number**, so the count never flickers to 0. Everything else is P1's enum. The UI derives nothing statistical itself.

## 4. States, surfaces and copy (copy deck is `prototype/copy.ts`)

| State (reason) | Rail `suggested` | Slot on press (≤ 75 chars + action, fits 320) | `why?` baseline block | Primary action where it applies |
|---|---|---|---|---|
| `checking` | dashed, no tally | Checking saved tests… | Checking saved tests… | — |
| `not-started` | dashed, **no tally** (first visit unchanged) | Suggested needs 10 baseline tests · 0 done. [take test 1 →] | progress 0 of 10; what counts; ~5 min at your own pace | — |
| `in-progress` 1–9 | dashed + tally | … · 4 done. [take test 5 →] | same, n of 10 | result: **next test ↵**, practise |
| `pending` (`scan-incomplete`), < 10 | dashed + tally | At least 7 of 10 found; some results couldn’t be read. [check again] | "at least" count + read note | — |
| `pending` (`scan-incomplete`), proof = 10 | dashed, no tally | Baseline done; recent timing couldn’t all be read. [check again] | complete; "Using general until it can be read." | — |
| `complete-ready` | **ordinary key** (not checked unless chosen) | n/a | pair, ms vs ms, observations, words, runs; rule-of-thumb limit | final result: **try suggested · th ↵**, general |
| `complete-insufficient` (`stale-evidence`) | dashed, no tally | Baseline done; its timing is over 30 days old. [take an assessment →] | milestone kept; only timing needs refreshing | — |
| `complete-insufficient` (other) | dashed, no tally | Baseline done; no key pair stands out yet. Using general. More in why? | one plain reason + General/pair alternative | final result: **practise general ↵**, another assessment |
| `unavailable` (`storage-unavailable`, `policy-invalid`, `context-unavailable`) | dashed, no tally, **no number** | Suggested needs results saved in this browser; saving is off here. / …unavailable in this version. | reason + "General and pair practice work as usual." | — |

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

Every insufficient outcome ends with: *General practice fits best for now, and pair practice lets you pick a pair yourself. Suggested re-checks after each saved 30-second run.* That sentence states what happens next without asking the person to keep testing (P1 §41).

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
                                               └─ save failed: "Counts once it’s saved." retry/export (accepted row); continuing is never blocked
 / ready (later visit) ── next preparation recomputes ──▶ unchanged | focus changed (slot: "Suggested now leans on er …")
                                                       | stepped back (slot: "Suggested stepped back to general: th no longer stands out clearly …")
 Progress ▸ start a new baseline ▸ [keep current baseline] (focused) | [start over] → epoch reset, 0 of 10, results kept
 Source deletion ▸ count re-derived at next read (may drop 10 → 9; Suggested locks again; why? always explains the count comes from saved tests)
```

Rules the implementation must keep:

1. **Counting only after durable save.** A pending segment shows in graphite. A failed save never increments, and the accepted retry/export row is reused.
2. **Nothing subtracts except deletion, reset or context change.** A flagged or too-short run says *not counted*, never *lost*.
3. **Change, retire and unlock evaluate at preparation only** (P1 confirmed). A running block never changes label, text or focus. A late read refreshes the rail and `why?` only, never the active snapshot.
4. **Ordinals use `counted + pendingSave + 1`.** If a pending save is finally lost, the next label reuses the number. That is honest, and the unsaved line has already said why.
5. **Remembered kind is respected.** Unlock never auto-selects Suggested on `/`. Only the final result's explicit *try suggested* does. If a remembered Suggested has no focus at preparation, the block is General and the slot gives the one-time reason (from the latest saved practice result's `practiceFocus`, so no new storage).
6. **Focus.** `/` and the assessment page keep the native textarea focused on load. A locked-key press keeps focus on the key, and the accepted "start typing ↵" cover handles return. Results focus their primary key, and Enter acts only on that focused key. Reset confirm focuses the safe choice. After reset, focus goes to the section heading (`tabindex=-1`) and the status is announced via `role=status`.

## 6. Reconciliation with P1 `e484754`, and challenges

Adopted 1:1: 10 × 30 s flow-v1 assessments with explicit QWERTY in one bucket; a test counts after durable save with ≥ 1 accepted insertion and no integrity flags, with no accuracy or clean floor; count capped at 10 with no age expiry; freshness only on target evidence; non-destructive epoch reset; witness-derived counts; `baselineProofComplete` / `evidenceScanComplete`; `pending/scan-incomplete`; the ordered reason precedence; no suggestion before ten; retire/switch at preparation.

**Challenges and proposals for root:**

- **C1 — The completed experience under-delivers "personalisation" unless completion is worth something on its own.** P1's coverage probe shows that ten tests at slow speeds can yield zero clean timing, and even an ideal 60 WPM run supports about one pair. So *complete-insufficient* is probably the common ending. **Proposal:** the final result shows a descriptive **baseline summary** (median WPM and accuracy of the ten witness tests; claim 2, descriptive only). Completion then always gives the person something true about their typing. Prototyped in states 11/12/27 and marked as a proposal. It needs root/P1 to define the statistic and its witness set.
- **C2 — Keep the multi-context picker out of v1.** A user-visible "context" concept (switching keyboards or people) costs explanation and a picker, for a rare case that **start a new baseline** already covers ("someone else used this browser or you changed keyboards"). **Recommend:** v1 ships the default context plus epoch reset only, and the context schema can stay dormant. Decision/exposure provenance sidecars are invisible to the UI; the `why?` explanation needs only the current snapshot.
- **C3 — Exposure honesty on Suggested results.** P1 requires dose facts. If exposure instrumentation lands, the Suggested result adds one line: *th came up 14 times in this block*, with `too-short-to-evaluate` / `partial-context` worded as *too short to say how much th you practised*. If it doesn't land, the result makes **no dose claim**. Never show planned dose.
- **C4 — One accepted key counts as a test.** I accept this: participation is deliberately weak, and the copy never implies quality. It does make the counter cheap, which is another reason C1 matters.
- **C5 — Hidden counter check.** There is exactly one visible counter (tests). The 20-run/30-day coach window is **not** shown as a second counter. It surfaces only as a reason sentence ("recent runs", "over 30 days old"), so no second number appears to the person.
- **C6 — `context-unavailable` wording.** Today the qwerty switch defaults off on a clean visit. A baseline test therefore needs one explicit qwerty press, explained by the assessment-page hint. That is honest but adds friction to test 1. Defaulting qwerty on would be a policy change (P1 forbids inferring the declaration), so it is not proposed.

## 7. Not in this contract

Undo/Redo, metric changes, the selector itself, error-focused coaching, beginner curriculum, accounts, sync, deployment, and any claim that practice improves typing.
