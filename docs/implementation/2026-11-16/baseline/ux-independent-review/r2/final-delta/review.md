# Independent actual-Claude acceptance of delta r2.1 (D1, D2, N1, N2)

18 November 2026 · Task `task_0148263eda79`, Dispatch `ctx_9cf5982c12df` (same reviewer terminal as `05a6767` and `b534512`). Brief: root `8c5c505` `task-claude-ux-final-delta-review.md`. Subject: author `df765f27` (root `eeaec1d`), `ux/delta-r2.1.md`, composed with root style blob `1b10cbea…` and Vite 8.3.3. My earlier reviews (`../review.md` REVISE at `b534512`, `../../review.md` REVISE at `05a6767`) are unchanged. This is the focused recheck that `b534512` called for, not a new full audit.

## Verdict: **APPROVE**, scoped

**Scope of the approval.** I approve the exact corrected prototype (`df765f27`) together with its contract, handoff and finite-plan-end text, composed with root's accepted stylesheet and Vite 8.3.3, **as a fixture-level UX contract**.

**What it does not cover:**
- production UI
- the engine, storage or P1 r2 projection
- the finite producer and validator
- the reset authority implementation
- human comprehension or native assistive-technology behaviour

**Findings now closed.** N1 and N2 from `b534512` and the D1/D2 deltas are closed. The combined record across my three reviews:
- the eight original findings are resolved;
- the focus-scroll judgment is preserved;
- the byte-composition evidence is extended to this build.

## Composition

I built the corrected prototype with my r2 runner (`../runner/vite.r2.config.mjs`, unchanged) against the root style blob `1b10cbea…`, a root lockfile (`151cf9b3…`) and Vite 8.3.3, outputting `index-DLHZ6HQf.js` (`a7f8d559…`).

The production-style chunk (`9718178b…`) and `baseline.css` (`daad75ed…`) are byte-identical to the r2 composed build. I also replayed the author's toolchain separately in scratch (Vite 8.3.1, style `41426a7`). It reproduces the author's `index-CSlT-Irp.js` (`b63966d8…`), with JS identical to mine modulo chunk names and the fixtures JS byte-identical.

So the earlier finding still holds: the only built difference is the accepted forced-colours block (`evidence/source-sha256.txt`).

## Dispositions

| Item | Verdict | Independent evidence (composed build, 1440/390/320) |
|---|---|---|
| **D1** prior pair only from the in-memory admitted snapshot | **Closed** | 18/18. **With** a prior snapshot in the document (fixture stand-in), the slot names the previous pair once (*stepped back to general: th…*, *Suggested now leans on er. th no longer stands out…*). After a **simulated reload**, the stepped-back state reads *Suggested has no focus for now, so this block is general. More in why?*, and the changed state is simply *Suggested practice · er · 30 s*. Navigating away and back gives the same result as the reload. In none of these does any slot, screen-reader description or why? name `th`, and why? gives only the **current** reason. The remembered Suggested kind is kept, unlock does not auto-select, and focus stays in the text. |
| **D2** exactly 30 s with declared QWERTY; honest General fallback | **Closed** | 18/18.<br>• **Mismatch:** at 60/120 s or with qwerty off, the block runs and is labelled **General practice · 60 s** (or 30 s). The chosen duration stays checked, so it is not clamped.<br>• **Hint:** the slot says why, with **[use 30 s]** / **[my keyboard is qwerty]**, which is one Tab away and in view at 320 with no clipping.<br>• **why?:** it says the block is general and shows no focus evidence.<br>• **Recovery:** each key is the person's own press of the existing control, after which the label becomes *Suggested practice · th · 30 s* with focus back in the text.<br>• **Ordinary practice:** changing duration before the first key moves between the two states. General at 60 s is an ordinary run with an ordinary result. The finite plan never runs outside 30 s (general prompts, no end marker, ordinary result). |
| **N1** ready-focus explanation and reason precedence | **Closed** | 102/102.<br>• **Ready focus:** `complete-ready` with reason null, absent or `supported`, in both kinds and at all widths, explains *th: 212 ms against 168 ms…* and never says "unavailable".<br>• **Reason matrix:** 16 reasons (P1's 14, plus `supported` and an unknown one) × 5 coaching states, enabled+scanned, enabled+scan-false, disabled, unavailable+null and unavailable+false. No `undefined` appears. No gate sentence appears without a gate that ran, and nothing advertises an unlock unless coaching is enabled. "Switched on" never appears for an unavailable config. The *re-checks after each saved 30-second run* promise appears **only** after the seven gate reasons with enabled coaching and a completed scan.<br>• **Final results:** the re-check line appears for insufficient/sparse and not for deferred/ready. |
| **N2** flagged finite end | **Closed** | 6/6. Focus loss followed by finishing the plan gives *Suggested practice · th · all 3 sentences done at 15 s of 30*, time still left, the **Flagged…** line instead of the end observation, no figures, and **suggested again ↵** focused. A clean end is unchanged: early-end label, small-set observation, no flag, no figures. |

**The three formerly pending cases, now concrete (9/9 pass):**
- `automaticCoaching: 'unavailable'` at **4**: the press and the screen-reader description say *Suggested is unavailable here/right now. General works as usual.* why? keeps the honest participation framing (*4 of 10 tests… 10 short baseline tests give a steady picture…*, **take test 5 →**) with no Suggested promise. **Pass.**
- At **10** (`policy-invalid`): *Baseline complete. Suggested is unavailable in this version of TypeForge.* plus *General and pair practice work as usual.* There is no "switched on" and no re-check promise. **Pass.**
- Suggested at **60 s**: General · 60 s with the honest hint and no clamp. **Pass** (this is D2).

**My r2 script on this build** (copied unchanged, sha256 `3ae5ee95…`): 87 pass, 0 fail, 3 informational. Against r2 it recorded 78/9/3. Those three are the cases the focused script now turns into the verdicts above.

## Non-blocking observations (P3, no change required for this approval)

- With Suggested remembered at 60 s, the rail still shows **suggested** checked while the label and slot say General, and the key's screen-reader description is *Available: th.* The visible label and the slot carry the truth, and keeping the remembered choice is the no-clamp rule working as intended. An implementation could append *(30 s, qwerty on)* to that description.
- In the flagged finite end, the run-time slot notice (*Focus left the text…*) still shows above the result's **Flagged** line. This is the existing behaviour for every flagged result, not something the delta introduced.
- Forced colours: 39/41/42 captured at 3 widths. The delta adds no new colour or shape state. Under the root rules, the checked *suggested* key uses Highlight while the label reads General, which is the same honest pairing as above.

## Implementation boundaries carried forward (technical, not UI failures)

- **EpochReset (A2 `f7ddfdd`, root `3caadca`).** `resetEpoch` returns `{committed:true, authority}`, `{committed:true, authority:null, reason:'authority-exhausted'}` or `{committed:false, …'context-unavailable'|'storage-unavailable'}`. The prototype models only the first. The implementation **must not** announce *New baseline started: 0 of 10* or show a usable count unless `authority` is non-null and the re-read proves it.
  - **Proposed copy, for the author deck:**
    - committed with no authority: *A new baseline was started, but saved tests can't be counted right now. General works as usual.* → then the unavailable state, with no number.
    - not committed: *A new baseline couldn't be started here. Your current baseline is unchanged.* → focus returns to **start a new baseline**.
  - Either way, status is announced via `role=status` and focus goes to the heading, as today. This is an acceptance test, not a prototype revision.
- The UI ports must still use P1 r2's separate `participation`/`summary`/`coach` projections, `participation.ordinal`, and `pendingSave` (compatible, captured, unsaved assessments only). They must also use the ET-1 leaving guard for an unsaved final test and the finite producer/validator before any early-end figures. All of these are from `b534512` and unchanged.

## Implementation acceptance still required

Run on the real build with injected P1 r2 statuses:
1. Port `evidence/scripts/final-delta.mjs` and `r2-delta.mjs`, plus the author's `delta-regressions.mjs` and `regressions.mjs`.
2. A real reload and navigation proving no prior pair is named (the fixture `reload=1` is a simulation, not browser-persistence proof).
3. All three EpochReset branches.
4. Finite engine cases including flagged → end.
5. Windows High Contrast, a screen reader, Firefox/Safari, a physical phone and IME.
6. The short human comprehension check (original criterion 10), which is still open.

## Executed, receipts and limits

- **Runner and preview:** hidden PID 14340, `node.exe …/typeforge-daily-practice/typing-app/client/node_modules/vite/bin/vite.js preview --config …/r2/runner/vite.r2.config.mjs`, on `127.0.0.1:5318 --strictPort`. I verified it was the listener, then stopped it, and 5318 was free afterwards. Root's 5301 (PID 28552) was untouched.
- **Browser:** headless system Chrome via playwright-core 1.65.1 (scratch), with a fresh context per check.
- **Results:**
  - `final-delta.mjs`: 153 checks, 153 pass.
  - `r2-delta.mjs`: 87/0/3.
  - 33 affected-state captures: states 14, 18, 19, 37, 39–42 at three widths, plus forced colours for 39/41/42. 0 page errors, overflow, clipped slots or `undefined`.
  - 66 screenshots in `evidence/sha256.txt`.
- **Author evidence:** the author's 60/60 and their replay of my script (87/0/3 on their toolchain) were read but not used as evidence.
- **Receipt (`evidence/receipt.json`):** this dispatch reused the reviewer terminal. Orca records no new requested model or effort. Effective agent is `claude`, with provider projection `claude` / `claude-opus-5-5`. The terminal's origin launch `ctx_f5e22117b85e` recorded requested and effective `claude` / `claude-opus-5-5` / `high`. The session's self-reported model is `claude-opus-5-5`; effort is not visible from inside. No helpers were used.
- **Limits:** simulated fixtures, simulated saves and reloads, and a 10× clock where labelled. One engine with emulated viewports and forced colours. No production engine, storage, P1 projection, finite validator or reset authority. No screen reader, Windows High Contrast or human participant.
