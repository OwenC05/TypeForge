# P4 release-risk verification

16 November 2026; evidence-only branch. Parent task `task_08e5d0d508f0`, dispatch
`ctx_8e8d2efe1568`; worker terminal `term_d2b1fa7b-3bbe-434e-ba3c-6376dec7605f`.
Observed worker launch: Codex 0.169.0, `gpt-6.1-sol`, `model_reasoning_effort=medium`,
PID 3796 (`worker-process.json`). Requested and observed launch settings match;
this is process configuration, not independent backend model attestation.

## Outcome

The dependency warning remains **two high vulnerable packages**, both in the
development/tooling graph. Seven advisory records aggregate under those two nodes.
The production dependency audit reports **zero**. No exploit against the shipped
static browser client is established. Minimal proposed repair: **Vite 8.3.1 ->
8.3.3**, plus transitive **source-map-js 1.2.1 -> 1.2.2** within PostCSS's existing
range; no blanket audit fix or broad upgrade. See [S1 report](s1/report.md) for
advisory-specific preconditions and primary-source snapshots.

Chrome 157.0.8103.52 and Edge 157.0.4341.60 each passed **46 existing + 15 focused +
11 supplemental = 72 functional/programmatic checks**, with **132 source tests**
and production typecheck/build passing. Both products use **Chromium**. There is no
Firefox, Safari/WebKit, physical mobile/IME or real screen-reader acceptance claim.
Actual Claude identified **F-1, checked setting state lost under forced colors**;
technical passing media/reachability checks do not override that visual defect.
See [B1/A1 report](browser-accessibility.md) and raw evidence for exact boundaries.

## Ranked issues and bounded assignments

| Rank | Finding / severity | Follow-up owner and files | Acceptance |
|---|---|---|---|
| 1 | **High audit severity, tooling applicability:** Vite 8.3.1 (six records) and source-map-js 1.2.1 (one high). Several Vite preconditions are absent in this native Windows loopback configuration; Windows editor and Node Wasm paths still merit the small repair. | Root assigns a dependency-only owner for `typing-app/client/package.json` and `package-lock.json`. | Pin minimal fixed Vite patch and refresh source-map-js only; inspect unrelated churn; clean install, dependency tree, both audits, 132-or-current source tests, typecheck/build; repeat first-key/edit/Again/settings/failure flows on exact repaired assets. New advisories must be triaged at repair time. |
| 2 | **Medium release priority, confirmed existing accessibility defect F-1:** forced colors makes checked and unchecked setting keys visually identical; checked roles remain correct. | Actual Claude UI owner through root; narrow `typing-app/client/src/style.css` checked selectors. | Persistent visible checked cue under forced colors, explicit Claude verdict for duration/practice/QWERTY; preserve focus/disabled cues, keyboard behavior and persistence; repeat native-input coverage. |
| 3 | **Moderate confirmed existing forced-color defect F-2:** Claude's Chrome follow-up confirms typed/untyped text state merges; caret position remains available. Wavy error cue, key focus and cover pass; expected glyph remains legible with minor lost salience. Edge follow-up pixels were captured but not inspected by Claude. | Actual Claude UI owner through root; narrow `typing-app/client/src/style.css` progress-state rules. | Visible typed-progress distinction without changing text geometry; retain correction/expected-glyph legibility and native selection/advance/focus. Obtain targeted independent delta verification after repair; no physical AT or multi-theme claim. |
| 4 | **Existing coverage gaps:** only Chromium products available; AT speech, physical IME/devices and actual high-contrast theme variants untested. | Release/input/accessibility QA. Evidence-only files until a reproduction assigns a repair. | Capture exact engine/OS/AT versions and source/assets, exercise the scoped cases on actual platforms, and explicitly retain any unavailable-platform gaps. |

The initial skip-link probe's failed `activeElement === main` assumption is retained
as harness evidence. Follow-up verified that the next Tab enters the first setting
inside main and bypasses header navigation; no skip-link bug is asserted from that
first assumption. No production fix or dependency repair was made in this task.

## Ownership, provenance and stop condition

P4 split into S1 (audit applicability), B1 (native browser flows) and A1 (accessibility
evidence). Independent S1 used a single Orca helper in this same child worktree:
task `task_734594b249ff`, dispatch `ctx_cd1bc65d8d69`, terminal
`term_32192290-50cb-42fa-bea6-05d8c9997644`, requested/observed `gpt-6.1-sol` medium.
It owned only `release/s1/`, no browsers/ports/builds and no recursive helpers.
P4 owned B1/A1, preview 5314 and this integration report. Its initial prompt was
observed still in the composer; one supported orchestration follow-up was sent.
Root subsequently proved active execution from the exact provider transcript;
no worker was stopped, abandoned, duplicated or steered through terminal input.
S1 settled successfully in `msg_18cec650a264` with its audit/report complete.
Actual-Claude visual verdicts are `msg_ad656d2e84ee` (ready F-1) and
`msg_c635e69c7f71` (Chrome typed/focus/cover follow-up). Root assigned a separate
P2 F-1 repair in `msg_818679e94aea`; this snapshot keeps both defects open until
the repair commit and targeted independent verification arrive. P4 does not wait
for or claim that separate production fix as part of its evidence completion.

Application sources and package/lock files match baseline `b3fb14c` at verification
HEAD `c65460b91ab2b310cb51f2f8cd4247d6c9f7c482`; this later HEAD includes planning
records. `browser-evidence.json` freezes source/lock and production asset SHA-256s.
A bounded built-output scan found zero occurrences of `/@vite/client`,
`__open-in-editor`, `source-map-js` or `SourceMapConsumer` (`bundle-scan.json`). This
supports the static applicability analysis without claiming an exhaustive bundle
security audit. Source/lock classification and upstream preconditions remain the
main S1 evidence.

All writing is confined to this release directory. The two hidden owned preview
processes (14920, then 8760 for follow-up captures) were stopped after verifying
their executable and exact strict-port commands. Browser handles/contexts were
closed by their runners. Root preview 5301 and Portfolio were untouched.
No install of a browser, user profile modification, package/lock edit, push,
deployment, global config change, account/paid action or user data upload occurred.
The local locked app dependencies were installed with `npm ci --ignore-scripts`
solely for build/verification; no dependency versions changed.

Task completion means committed, reconciled evidence and bounded assignments;
it does **not** mean the proposed dependency/accessibility repairs or unavailable
platform acceptance have been completed. Audit exit 1 and the preserved initial
probe failure are requested evidence with explained outcomes, not concealed
regressions. Repository lint is not configured as a separate script; no lint pass
is claimed.
