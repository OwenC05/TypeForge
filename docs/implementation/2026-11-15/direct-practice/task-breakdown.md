# Direct-practice redesign: task breakdown

15 November 2026. Owner: actual Claude design lead. Orca Task `task_6815dfce6ce4`, Dispatch `ctx_f3ee7deba6f6`. Written before any edit.

**Authority:** `typeforge-daily-practice/.omx/plans/typeforge-direct-practice-redesign-20261115.md` (root commit `b898dc6`).
- Owen rejected prototypes A and B as "pretty average". This supersedes the A/B choice and the first-run setup panel.
- No new A/B or taste-approval gate.

**Bases:**
- Root `feature/daily-practice` @ `b898dc6`. Application source there is still `de69444`; foundation repairs are not yet integrated.
- Previous prototype records stay untouched: `OwenC05/tf-proto-a` @ `0ee69ec` and `OwenC05/tf-proto-b` @ `5e763aa`.

## Product contract (from the brief, condensed)

1. **Arrival.** `/` shows real, ready-to-type practice on the first and every later visit.
   - No hero, no landing or onboarding detour, no mandatory Start or configuration step.
   - No required keyboard declaration.
   - Clean first visit defaults to 30 s General practice. Valid remembered choices are restored. Assessment defaults and protocol stay separate.
2. **Settings.** Time and supported options are discoverable and optional. The real controls show the current state. Opening a settings control is always intentional.
3. **Timing and focus.** The first accepted native insertion starts timing and is counted once.
   - Safe contextual focus only. No global printable-key capture. No focus stealing.
   - Basic practice never waits on optional history, model or summary work.
   - Blocked storage or a missing model still leaves General practice usable.
4. **Visual treatment.** One coherent, distinctly better treatment across arrival → typing → error/correction → completion → repeat.
   - Actual Claude chooses type, palette and materials from inspected evidence.
   - A and B are rejected baselines. Their tested mechanics may be reused, but not their appearance.
5. **Preserved, unchanged:**
   - engine and scoring;
   - native textarea editing and selection;
   - honest error, integrity and save feedback;
   - immutable history and assessment/retest lineage;
   - strict storage validation and after-any-edit prediction freezing;
   - no viewport-driven prompt choice and no invented ML or learning claims.

   Wrapping is resolved only through geometry-tested presentation.
6. **ui-sdk.** Minimal `@ui-sdk/core` + `@ui-sdk/web` (matching versions), per-component imports, `@layer ui-sdk;`, deliberately styled.
   - The typing editor stays a native domain instrument. It is the narrow exception to SDK wrapping.
   - A `createAgent` wiring test covers the settings controls with source-aware validation and denial.
   - Agent writes never count as human timing.
   - No network agent service and no broad production WebMCP tools.

## Tools actually available to the lead (checked, not assumed)

- **Awwwards MCP:** none. `ToolSearch "awwwards uizze inspiration"` found no tools, and `~/.awwwards-mcp/` does not exist. Fallback: public Awwwards pages and live sites, captured with playwright-core plus system Chrome in the lead scratchpad. Each capture's source URL and date is recorded.
- **Uizze MCP:** none. The free `ui-taste` playbooks are used. No paid access.
- **Image generation:** this Claude host has no authorized image-generation tool for this task. A Figma connector exists, but it would create content in an external account, so it is not used. Root generates the image mechanically from the lead's prompt via an Orca `ask` (the brief's path).
- **Skills read** (absolute paths):
  - `C:/Users/Owenc/.codex/skills/ui-sdk/SKILL.md`. Its references go to the SDK owner.
  - `…/typeforge-daily-practice/.agents/skills/ui-taste/SKILL.md`, `reference/research.md`, `references/uizze-image-to-ui.md`, `references/uizze-visual-verification.md`.
  - `…/typeforge-daily-practice/.agents/skills/awwwards-inspiration/SKILL.md`.

## Tasks

| # | Task | Owner (agent / model / effort) | Allowed files | Depends on | Validation / artifact |
|---|---|---|---|---|---|
| T0 | This breakdown; resource allocation | Lead, Claude `claude-opus-5-5` (inherited) | this file | — | committed |
| T1 | **ui-sdk feasibility and agent-test contract.** Check current published versions; install matching `@ui-sdk/core` + `@ui-sdk/web` in the implementation workspace. Read installed `docs/llms.txt` and only the needed component pages and types (duration choice, practice kind, QWERTY toggle, settings popover/disclosure, primary button). Measure bundle cost. Build a minimal, unstyled, isolated proof that the components mount in this Vite/vanilla-TS app. Write the `createAgent` wiring-test harness that the browser harness can host. Write a design-neutral API/usage note for the Claude integrator. **No visual decisions; no edits to `app.ts` UI structure or `style.css` design.** | Codex child, `gpt-6.1-sol`, effort high | `typing-app/client/package.json`, `package-lock.json`, a new isolated proof module and test under `typing-app/client/tests/` or `src/ui-sdk-proof/`, `docs/implementation/2026-11-15/direct-practice/ui-sdk/**` | T0 | `npm ci`, `npm test`, `npm run build` exit codes; the agent test runs and passes; bundle delta recorded; versions recorded |
| T2 | **Research and direction brief.** Inspect the current UI and A/B. Name ≤3 deficits. Research 2–3 relevant references plus the existing Monkeytype/Keybr evidence, with live captures and sources. Write the direction (architecture, hierarchy, type, palette roles, spacing, controls, state inventory, explicit departures) and the image-generation prompt. | Lead (Claude) | `docs/implementation/2026-11-15/direct-practice/research/**`, `direction.md` | T0 (parallel with T1) | committed brief; then Orca `ask` to root with the prompt |
| T3 | **Inspect the generated target.** Record actual dimensions; fix material issues (correction prompt or recorded narrow departures). | Lead | `…/direct-practice/target/**` | root's image | target recorded |
| T4 | **Implementation.** In the same implementation workspace, after T1 settles: cherry-pick the lead's doc commits, then implement the direction 1:1 at the target viewport.<br>• No-gate `/`; optional settings with ui-sdk controls; remembered values; continuous repeat.<br>• Geometry-tested wrapping; preserved engine, caret, error, save and lineage behaviour.<br>• `DESIGN.md` updated to this direction.<br>• Render/compare/correct at 1440×900, 390×844 and 320; real 200% zoom; state captures; `visual-evidence.json` plus the integrity helper.<br>• Bundle/performance measurement taken alone. | Claude child, `claude-opus-5-5`, effort high | client UI `app.ts`, `style.css`, HTML entries, small UI helpers, tests (new files preferred), `DESIGN.md`, `docs/implementation/2026-11-15/direct-practice/**` | T1, T3 | `npm test`, `npm run build`, `typing-flow.js` (updated only for intended changes, with the reason recorded), geometry matrix, agent test, visual evidence, integrity helper |
| T5 | **Independent technical review**: input correctness, timing and agent-write separation, regressions, test honesty. Read-only, with findings. | Codex child, `gpt-6.1-sol`, effort medium | none (report under `…/direct-practice/review/`) | T4 | findings report |
| T6 | **Design review and acceptance**: target-vs-render inspection, state walk, fixes routed to the T4 owner, final report to root | Lead | `…/direct-practice/lead-review.md` | T4, T5 | committed review; `worker_done` |

**Concurrency.** At most two immediate children are active at once:
- T1 runs in parallel with the lead's T2.
- T4 starts only after T1 settles, in the same Orca-created implementation workspace, so ownership hands over in sequence and no two agents ever write it at once.
- T5 runs after T4.

The lead's own docs are committed on `OwenC05/typeforge-design-prototypes` and cherry-picked by T4, so root integrates a single implementation branch.

## Resource allocation

| Resource | T1 Codex | T4 Claude | T5 Codex | Lead |
|---|---|---|---|---|
| Workspace | Orca `new-child` of the lead workspace, name `tf-direct-practice`, base `feature/daily-practice` @ `b898dc6` | same workspace, after T1 | same workspace, read-only | lead workspace |
| Port (`--strictPort`) | 5302 | 5301 | 5304 | 5303 |
| Browser profiles | its scratchpad, `dp-sdk-*` | its scratchpad, `dp-impl-*` | its scratchpad, `dp-review-*` | lead scratchpad, `dp-lead-*` |

- Performance and bundle measurements run only while no sibling build or browser is active.
- Helpers start hidden, are tracked by PID and are stopped by their owner.
- Never touch: Portfolio, the original checkout, `typeforge-daily-practice` (root; read-only, for skills and the brief), `typeforge-foundation`, `tf-proto-a`, `tf-proto-b`.
- User-owned `.agents/skills`, `.claude` and `skills-lock.json` changes are never committed by this lane.

## Model and effort decisions

- **Design and integration (T4): `claude-opus-5-5`, effort high.** It is consequential visual and interaction work. The identifier is observed in this host (this lead and the earlier A/B children).
- **SDK feasibility (T1) and technical review (T5): Codex `gpt-6.1-sol`.** The identifier is observed in this host's Dispatch list (the foundation lead). `gpt-6-astra` is also observed, but its relative fit is unverified here, so it is not chosen silently.
  - T1 effort high: a new dependency plus an agent/timing-separation contract.
  - T5 effort medium: a bounded review of a known diff.
- Requested settings are recorded separately from each child's self-reported receipt. Applied effort is never inferred from telemetry.

## Failure handling

- If ui-sdk cannot fit cleanly, T1 reports the concrete blocker and the lead escalates to root. The lane does not silently drop the authorized SDK, and it does not hand-roll ARIA widgets that the SDK ships.
- If a wrapping approach fails geometry, the geometry-safe behaviour is kept and recorded as a failure.
- A failed or unknown child launch follows the Orca recovery reference.
