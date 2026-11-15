# ui-sdk technical feasibility

15 November 2026. T1, `task_9ac25f08412c`, dispatch `ctx_163a1aaa3af4`.
Owner: Codex, technical mechanics only. All visual and UX decisions remain with the actual-Claude lead and T4 integrator.

## Result and scope

`@ui-sdk/web` integrates with the existing Vite 8.3.1 / vanilla TypeScript 7.0.2 app without a framework, extra runtime packages, a testing framework, or changes to `src/app.ts`, `src/style.css`, or `vite.config.ts`. The isolated proof mounts five component entries and a test-only agent bridge beside the **real application**, then forwards accepted SDK setting changes through the existing native settings controls and their change handlers. This verifies an integration seam, not the final redesign.

The proof is `typing-app/client/tests/browser/ui-sdk-proof.html` plus `ui-sdk-proof.ts`. It declares `@layer ui-sdk;` in its head and imports no `web.css`. Its controls have no authored appearance. The imported real app retains its existing stylesheet. The nested test HTML is excluded by the production config's root-HTML input discovery; neither the proof nor its agent bridge ships in `npm run build`.

Read authority: the direct-practice redesign brief's Product contract and Explicit skills/dependency scope; this workspace's execution handoff; the original review handoff, approved PRD/test specification, planning receipt, Architect/Critic revision-3 reports; the lead's T0/T1 task breakdown. The existing breakdown supplied ownership, dependency, acceptance criteria, resource allocation, and stop condition before editing. No foundation repair, design decision, production WebMCP registration, network agent service, or source-instrument change is included.

Workspace: `C:/Users/Owenc/orca/workspaces/TypeForge/tf-direct-practice`, branch `OwenC05/tf-direct-practice`, base `b898dc6` (application source `de69444`). Requested model/effort: `gpt-6.1-sol` / high. The exact-dispatch Orca projection reports provider `codex`, model `gpt-6.1-sol`; this is the observed routing receipt, not an independent provider execution attestation. Applied effort is unknown because the receipt exposes no effort. No subagents were used.

Implementation commit: `a0fa529` (`test: prove ui-sdk settings and agent input separation`); the following evidence commit contains this note and JSON results.

## Versions and installation

Registry checks returned `0.1.0-beta.3` for both packages. Core has no peer dependency entry; web requires `@ui-sdk/core: ^0.1.0-beta.3`. Both are pinned **exactly**, and `npm ls @ui-sdk/core @ui-sdk/web` confirms one deduplicated core.

From `typing-app/client`:

```powershell
npm view @ui-sdk/core version peerDependencies --json
npm view @ui-sdk/web version peerDependencies --json
npm install --save-exact @ui-sdk/core@0.1.0-beta.3 @ui-sdk/web@0.1.0-beta.3
npm ci
```

All four commands exited 0. Only these two dependencies were added; npm updated the lockfile. `npm ci` reported the same two high-severity dependency advisories before and after this installation; remediation is outside T1 and was not applied.

## Documentation and types inspected

The installed `node_modules/@ui-sdk/web/docs/llms.txt` was read first. Selected component pages: `components/segmented-control.md`, `switch.md`, `select.md`, `collapsible.md`, and `button.md`, focusing on composition, control/events, styling hooks, controller API and keyboard sections. Relevant bridge sections of `docs/agents.md`: creation, permissions/cancellation, snapshot/query/action results, source reporting and reference.

Skill sources: `C:/Users/Owenc/.codex/skills/ui-sdk/SKILL.md` and its `references/build-interface.md`, `web-components.md`, `agent-ready.md`, `testing.md`, and `styles.md`. The last was read only to understand the optional default stylesheet; that theme is not adopted. The Orca orchestration skill/live guide and local ponytail skill were also read.

Types: web `dist/agent.d.ts`, `dist/index.d.ts`'s relevant type exports, `dist/events.d.ts`'s change events and the five element interfaces; `dist/entries/{segmented-control,switch,select}.d.ts`; internal registration declarations for segmented control/collapsible/button; core segmented-control and collapsible controller declarations. No compiled SDK JavaScript was read. The bundler resolving/executing installed modules is separate from source inspection.

The [official agent documentation](https://ui-sdk.dev/docs/agents) was checked as a secondary reference. Context7 lookup returned an unrelated account-abstraction UI-SDK, so it was not used as evidence; installed, version-matched docs/types and executable browser probes govern this note.

## Component API for T4

These are feasible technical alternatives, not a choice of product layout. The proof uses segmented controls for duration/practice, Select for the supported pair list, Switch for keyboard declaration, Collapsible for optional settings, and Button for a harmless close action.

| Entry | Root and required parts | Value / changes | Keyboard |
| --- | --- | --- | --- |
| `@ui-sdk/web/segmented-control` | `ui-segmented-control` → optional `ui-segmented-control-indicator`, `ui-segmented-control-item value="…"`. Item is the focusable radio itself, with no inner button. Name root using `aria-label` or a Field label. | `default-value`; live `.value: string \| null`; `.api.getValue()`, `.api.setValue(value)`, `.api.focus()`. Listen directly for `valuechange`. Values are strings: duration uses `15/30/60/120`; kind uses `general/recommended/manual`. | One Tab stop on checked/first enabled item. Both arrow axes select, skip disabled items and wrap unless `loop="false"`. Space checks; Enter submits a containing form. |
| `@ui-sdk/web/select` | `ui-select` → `ui-select-label`, `ui-select-trigger` → native `button` → `ui-select-value`; sibling `ui-select-content` → `ui-select-item value="…"`. Optional `ui-select-item-indicator`. | `default-value`; live `.value: unknown` (narrow it); `.items` as `{value,label,disabled?}[]`; `.api.setValue`, `getValue`, `setOpen`, `close`, `focus`. Direct `valuechange`/`openchange`. `.api.open()` resolves when closed, so do not await it merely to show the list. | Enter/Space/Down opens; arrows/Home/End move; typing finds items; Enter/Space chooses; Escape closes and restores trigger focus. |
| `@ui-sdk/web/switch` | Focusable `ui-switch` → `ui-switch-thumb`; no inner input/button. Name root with label or `aria-label`. | `default-checked`; live `.checked: boolean`; `.api.setChecked(bool)`, `getChecked`, `toggle`, `focus`. Listen for **`checkedchange`**, not `valuechange`. `.value` is the form submission string, not the on/off state. | Tab focuses; Space toggles; Enter submits a containing form and does not toggle. |
| `@ui-sdk/web/collapsible` | `ui-collapsible` → `ui-collapsible-trigger` → native `button`; sibling `ui-collapsible-panel`. Proof uses `keep-mounted hidden` on panel and names the root. | `default-open`; live `.open`; `.api.setOpen(bool)`, `open`, `close`, `toggle`, `isOpen`, `focus`. Direct `openchange`, `openchangecomplete`. | Enter/Space toggles; Tab enters open content; closed content is skipped. Closing while focus is inside returns focus to trigger. |
| `@ui-sdk/web/button` | `ui-button` → native `button type="button"`. Wrapper displays as contents. Visible inner text supplies name. | Direct cancelable `action` with `detail.source` and `detail.waitUntil(promise)` for pending work. Put SDK `disabled`/`focusableWhenDisabled` on wrapper. Put native type/classes on button. Agent action: `press`. | Native Enter/Space presses. Pending ignores duplicate presses and preserves focus. |

An exact tag selector infers its SDK element type, e.g. `document.querySelector('ui-switch')`. A compound selector such as `'ui-segmented-control#sdk-duration'` does not: use `querySelector<UiSegmentedControlElement>('#sdk-duration')`. Public component entries export controller factories/types as well as registering elements; import types with `import type` and runtime behavior only from per-component entries. Do not call internal `define…Elements` functions.

### Styling hooks without web.css

Declare `@layer ui-sdk;` before the application's authored CSS. The SDK injects a small behavior layer for display/hidden state; its default visual stylesheet is optional. Parts use light DOM. T4 supplies appearance, dimensions, focus/checked/disabled treatment and contrast using actual rendered slots/states. Avoid generated IDs as selectors. Trigger and Button slots are attached to the **inner native button**, not necessarily to their wrapper; inspect DOM before styling.

| Component | Slots / state hooks used or available | CSS variables |
| --- | --- | --- |
| Segmented | `segmented-control`, `segmented-control-item`, `segmented-control-indicator`; `data-checked`, `data-unchecked`, `data-disabled`, `data-readonly`, `data-required`, `data-orientation` | Indicator `--segmented-control-indicator-{left,right,top,bottom,width,height}`. Indicator positioning/animation is authored CSS, not automatic styling. |
| Select | `select-label`, `select-trigger`, `select-value`, `select-content`, `select-item`, `select-item-indicator`; open/closed, disabled/readonly/required, placeholder, selected/highlighted, content `data-modality` and `data-presentation`, starting/ending-style | Popup `--anchor-width/height`, `--available-width/height`, `--transform-origin`, `--arrow-offset`. Available dimensions do not inherit. Optional sheet variables include `--drawer-progress/dim/expand/stack`, `--sheet-backdrop`, and viewport/keyboard inset values. |
| Switch | `switch`, `switch-thumb`; checked/unchecked, disabled/readonly/required; invalid on switch when a surrounding Field is invalid | No component-specific variable listed. |
| Collapsible | `collapsible`, `collapsible-trigger`, `collapsible-panel`; open/closed/disabled; panel starting/ending-style | `--collapsible-panel-height`, `--collapsible-panel-width`. |
| Button | Inner `button`; `data-pending`, `data-disabled` | No component-specific variable listed. |

No icons, palette, spacing system, material, animation, or control placement is selected by T1. Headless technical tests do not certify contrast or visual quality.

## Agent contract and native-editor exception

`createAgent` comes from `@ui-sdk/web/agent`, once per page, before proof components mount. The proof exposes it only as `window.sdkProof.agent` on the test page. No `registerTools` or network service is installed. Agent actions use the same component APIs as human changes; the proof records `{setting,value,source,accepted}` and exposes the last source in `#sdk-source`.

The proof uses two independent checks: bridge `allow` refuses all settings actions while the real app duration control is locked, and each component's cancelable change callback repeats the lock and domain validation before forwarding to the existing application control. Validation permits supported durations/kinds/pairs, respects the real app's disabled Recommended option, and requires boolean QWERTY. The pair callback requires Manual mode. The production integration should replace this test adapter with its app-owned state/update function, using actual engine/restart/disposed state as the lock predicate. This proof's native-control adapter is not a new production architecture.

```ts
control.addEventListener('valuechange', event => {
  const { value, source } = event.detail;
  if (isLocked() || !isSupported(value)) {
    event.preventDefault();
    return;
  }
  applySetting(value, source);
});
```

Listen on the component itself or with capture: change events do not bubble. In web components cancellation is `event.preventDefault()`, not `event.detail.cancel()`. For asynchronous work, retain `source` explicitly across awaits if downstream writes need that attribution. Check final DOM/state after `agent.act`: `ok: true` can mean the action ran but its change callback canceled it.

The native `#typing-input` remains an unwrapped textarea owned by the existing typing instrument: keydown, beforeinput, input, selection, composition, integrity handling and engine measurement remain unchanged. This is the expressly authorized narrow exception to the skill's ordinary SDK-text-field rule. It has no SDK registration or agent value tool. Tests attempt both its ID and accessible label; neither can be resolved for agent `setValue`. Agent settings writes create **zero** editor keydown/beforeinput/input events, do not start a block, and do not insert text. After one real browser key, the saved real-engine result has exactly one attempted character and a 15,000 ms duration/elapsed time. Settings mutations during that run are denied.

This is separation of the exposed SDK capability, not a security sandbox against arbitrary JavaScript, browser automation, or extensions. It does not assert that arbitrary script assignment or a synthetic DOM event could never reach the app. Do not wrap the editor in `ui-textarea` or add a typing tool during integration.

## Executed checks

From `typing-app/client`, install the runner only into your own scratchpad (never the project):

```powershell
npm install --prefix C:/Users/Owenc/AppData/Local/Temp/dp-sdk-t1 --save-exact playwright-core@1.65.1
$env:PLAYWRIGHT_MODULE='C:/Users/Owenc/AppData/Local/Temp/dp-sdk-t1/node_modules/playwright-core/index.mjs'
$env:SDK_SCRATCHPAD='C:/Users/Owenc/AppData/Local/Temp/dp-sdk-t1'
node tests/browser/ui-sdk-agent.mjs
```

Agent-test command exited **0**, **67 assertions, 0 failures, 0 page errors**, Chrome `157.0.8103.52`. The runner starts only its own Vite server at `127.0.0.1:5302 --strictPort` using Node `windowsHide:true`, drives system Chrome headless, and closes both in `finally`. Its profile is created under the scratchpad with `dp-sdk-agent-*`, checked before recursive removal and deleted afterward. A previous frozen-clock probe was stopped by terminating only its recorded browser PID; its runner then executed cleanup. Final run server PID `45372` is stopped; no owned server/browser/profile remains.

Coverage: all entries named; choices discovered from snapshot/query; all four durations; General and Manual modes; actual supported pair changes; unavailable Recommended refusal; boolean validation; agent and keyboard source distinction; Button action; disclosure state/focus return; pair popup keyboard open/Escape/focus return; both duration arrow directions; Space on Switch; sequential Tab reachability for every setting/button; bridge denial and callback cancellation during a real timed block; native-editor exclusion and saved scoring separation. The test is a development-server wiring test and uses accelerated Playwright time for completion, not wall-clock timing evidence. Real AT, OS IME, other engines/devices, visual appearance and final redesign acceptance remain outside this proof.

| Command | Exit / result |
| --- | --- |
| Baseline `npm ci` | 0 |
| Baseline `npm test` | 1; 97 total, 94 pass, 3 fail, 0 skipped/canceled/todo |
| Baseline `npm run build` | 0; typecheck + 24-module production build |
| Dependency install and final `npm ci` | 0; only matching core/web added |
| Final `npm test` | 1; unchanged 97 total, 94 pass, same 3 fail, 0 skipped/canceled/todo |
| `npm run typecheck` after typed-selector correction | 0 |
| Final `npm run build` | 0; typecheck + unchanged 24-module production build |
| `node tests/browser/ui-sdk-agent.mjs` | 0; 67 assertions |
| `node tests/browser/ui-sdk-cost.mjs` | 0; three isolated production-mode probe builds |
| `node --check` on both `.mjs` harnesses; `git diff --check` | 0 |

The three failures were reproduced **before installation/editing**, in `tests/app.test.ts`: “Restart waits for fresh calibration and focus before enabling replacement input”; “restarted retest re-resolves exact origin; deleted, incompatible or unreadable origin becomes ordinary assessment”; and “assessment from URLs never acquire retest lineage on restart; explicit practice/retest origins retain their contracts”. All fail with the pre-existing CRLF-sensitive extraction `ERR_INVALID_TYPESCRIPT_SYNTAX`. No assertion was disabled/weakened and no E1/ML-04 repair was duplicated. Initial proof authoring exposed a TypeScript compound-selector inference issue; explicit SDK element types fixed it. Exploratory runner failures were fixed, not hidden by expected-failure marks.

## Bundle cost

Measurements ran sequentially without another T1 browser/build active. Production `npm run build` before/after displayed **JS 103.37 kB / gzip 36.16 kB**, **CSS 10.56 kB / gzip 3.14 kB**, with identical asset names. Exact totals below use raw bytes and Node `gzipSync` defaults on each emitted asset, summed; these compressed-byte figures differ from Vite's displayed compression estimate. HTML/SVG excluded. Lazy chunks are included in aggregate totals, so these are emitted-byte costs, not an initial-transfer or runtime-performance claim.

| Artifact | JS raw bytes | JS gzip bytes | CSS raw bytes | CSS gzip bytes |
| --- | ---: | ---: | ---: | ---: |
| Production before SDK | 103,372 | 35,923 | 10,562 | 3,138 |
| Production after SDK (proof excluded) | 103,372 | 35,923 | 10,562 | 3,138 |
| Production delta | **0** | **0** | **0** | **0** |
| Five per-component imports only, no app/agent | 199,082 | 69,128 | 0 | 0 |
| Same imports + `createAgent`, no app | 225,073 | 78,138 | 0 | 0 |
| Complete isolated proof including real app + bridge | 332,021 | 115,628 | 10,562 | 3,138 |
| Complete proof minus production baseline | **228,649** | **79,705** | **0** | **0** |

The agent bridge's import-only incremental aggregate cost is 25,991 raw / 9,010 gzip JS bytes. Components-only output includes a 161,423-byte entry and 37,659-byte sheet-presentation chunk. The complete proof includes its adapter, real app, component registration/bridge, and emitted optional chunks; it is not a forecast of T4's final layout bundle. No default-theme CSS is included; SDK behavior CSS is embedded in JS and installed at runtime. This is a material byte cost even with per-component imports; final production integration should be measured again.

Reproduce after `npm run build`, with the scratchpad environment variable above:

```powershell
node tests/browser/ui-sdk-cost.mjs
```

The script writes only `dp-sdk-*` probe entries/build outputs and `dp-sdk-bundle.json` under that scratchpad, leaves normal `dist` intact, and prints measurements. Checked-in `bundle.json` contains the measured per-asset values; `agent-test.json` captures the actual final agent snapshot/probe result.

## Docs/type discrepancies and remaining limits

1. Component controller prose says setting the live `.value` property acts like a controller write. The installed index's State and Events section instead says property/attribute writes emit no events. The browser probe confirms **`.value = '60'` updates the SDK component with zero callbacks**, while `.api.setValue('999')` is refused. Use `.api` or agent actions for validated requests; treat direct properties as owner-to-view synchronization and validate state at the app boundary. The proof does not expose property assignment as an agent tool.
2. Generated component API prose mentions `details.cancel()` although web events omit that function. `UiChangeDetail` and actual behavior use DOM `preventDefault()`. The general web-components skill reference understates `detail` as `{value,reason}`; actual typed events also carry `source` and `event`.
3. The skill reference says component entry types are `export {}`. This release's public `dist/entries/*.d.ts` exports useful controller factories/types. Internal `dist/<component>.d.ts` registration functions are not the public entry API. Use public entry imports shown above.
4. Closed disclosure contents are absent from the live usable snapshot until opened. Keep markup mounted, explicitly open the named disclosure in the test, then check all control labels. Do not filter out an unnamed live control. Long Select lists may omit `items` from `snapshot`; `query({within: label})` supplies the choices (as exercised here). Disabled Recommended appears among labels but is correctly refused on action.
5. The proof's forwarding adapter is deliberately test-only. It does not automatically keep SDK values synchronized when a person changes the old native controls directly, nor automatically rebuild recommendation availability after new history. T4 must make its own state the single owner, render current validity/availability, and preserve existing restart/lineage/integrity rules. Positive Recommended selection is not tested because this clean browser has no supporting history; no recommendation evidence was fabricated.
6. The existing app initializes asynchronous calibration before showing its editor. This T1 proof waits for that existing behavior; it does not implement the separate ready-immediately product requirement. Final T4 production agent wiring and tests remain necessary after UI integration, as do foundation test repairs and independent technical/Claude design reviews.

The T1 stop condition is met: dependency install, typed browser integration, source-aware agent contract, native-editor/scoring separation, reproducible cost evidence, and a committed technical handoff. No production visual result is claimed.
