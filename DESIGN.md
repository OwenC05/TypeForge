# Design
## Source of truth
Active · 30 September 2026. Surfaces: home, practice, results, progress, ML Lab. Evidence: existing app.ts/style.css, PLAN.md, docs/research/typing-products.md, approved recruiter-platform PRD/test spec. No approved pixel reference; existing navy/teal identity retained.
## Brand
Quiet, precise, encouraging. Trust comes from working controls and inspectable evidence, not AI spectacle. Avoid fake progress, exaggerated improvement claims and dashboard clutter.
## Product goals
A comfortable minute of typing, one explainable next practice action, and a reproducible ML experiment. Core experience quality rather than competitor feature parity. Accounts and public launch remain separate gates.
## Personas and jobs
Everyday physical-keyboard typists assess and practise; technical reviewers inspect provenance, evaluation, deployment and limitations without interrupting the main flow.
## Information architecture
Home → assessment → result → targeted/general practice → fresh retest. Progress reopens local sessions. Persistent ML Lab navigation separates technical evidence from typing. Lab leads with readable primary metrics and uncertainty, then source/cohort and secondary checks; raw report JSON stays in a collapsed evidence disclosure.
## Design principles
Native editing over custom editors; readable evidence over decoration; honest empty states over samples; a single primary next action on results. Preserve Enter submission and 60-second metrics.
## Visual language
Navy #0a111b background, #101b29 panels, teal #6ee7d0 emphasis, #e9eff6 text, #a0afc1 secondary text. System sans and local monospace. 8px-based spacing, thin borders, modest rounded corners. No remote fonts or imagery. Motion is nonessential.
## Components
Shared header/footer, buttons, metric cards, native typing surface, explanation panel, responsive evidence tables, text-equivalent SVG charts. style.css owns tokens; no new component framework.
## Accessibility
WCAG 2.2 AA target, not certification. Label native typing input; retain caret/selection, underline errors, visible focus, skip link and status announcements. Timer is not live-announced. Reduced motion supported. Keyboard-accessible scroll containers and sufficient contrast.
## Responsive behavior
Desktop max 1080px; collapse columns below 760px. At 390px navigation wraps, cards remain readable, tables scroll internally, words wrap. Controls remain usable at 200% zoom without page overflow.
## Interaction states
Explicit loading, empty history, no supported focus, absent model/report, skipped corrupt records and failed-save retry/export. Guest data stays local. Loaded sessions work offline; do not promise offline reload.
## Content voice
Concise and specific: observed, predicted, experimental. Explain evidence count/source and no-model fallback. No claims that prediction accuracy demonstrates training efficacy.
## Implementation constraints
Vanilla TypeScript/Vite, semantic HTML, native DOM/CSS/SVG/IndexedDB. No frontend dependencies, remote inference or key event upload. Existing native edit reconstruction and measurement semantics remain unchanged. Unit/type/build verification plus parent-owned Chromium checks; Firefox/Safari/physical timing remain release checks.
## Open questions
- [ ] External pilot, account provisioning and public deployment owner: project owner; outside this local release.
