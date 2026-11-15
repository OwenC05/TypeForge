# TypeForge handoff: critique first, then a better daily practice product

This is an authorized handoff from Owen's Portfolio conversation on 15 November 2026. Own the TypeForge work in this workspace and report directly to Owen here. Portfolio remains a separate active project; do not modify its files, processes, ports, branches, or agents.

## Owen's current direction

Owen is improving his portfolio for AI engineering, AI FDE, research engineering, data science and ML engineering roles. TypeForge should become a convincing, useful product with demonstrable technical substance. Product usefulness comes first; avoid adding ML solely for a portfolio claim.

His exact correction to our earlier emphasis was:

> A better daily practice experience, but also a polishing of the features we speak of. right now all it really is is a typing test and the ML has nothing to do with the actual typing it is just a study. the ui and experience should be comparable or better than https://github.com/monkeytypegame/monkeytype

The earlier suggestion to prioritize measurement/export plumbing was superseded by this correction. Preserve legitimate assessment and benchmark boundaries, but focus the product direction on enjoyable daily practice, typing improvement, useful feedback, polished existing features, and a defensible connection between ML and the typing experience.

Owen's latest explicit instruction:

> first do a big critique and review round by using the orca orchestration skill. it should review and critique the app for 1.UI UX 2. ML 3. Usefulness to typing improvement and more. It should use cluade for anything design related, make sure it is smart with assigning the model and effort too.

## First deliverable and workflow

Start with a substantial independent review round using the installed Orca orchestration skill. Load its SKILL.md and the live `orca skills get orchestration` guide before dispatching. You coordinate the review workers and synthesize their results. This handoff does not create a supervised assignment from the Portfolio agent; there are no upstream Task/Dispatch IDs to invent.

If the existing composer invokes a planning workflow, use this critique as the evidence needed before deciding the redesign or implementation plan. Preserve applicable workflow gates; do not manufacture runtime authority. A planning-runtime blocker does not prevent a separately authorized, ordinary read-only review through supported Orca orchestration.

For this first round, inspect code, run safe checks, exercise the actual app, and write review/evidence artifacts. Do not start a sweeping redesign or model rewrite before the synthesis is available. Capture failing checks as findings. Build/test results alone cannot establish product quality or typing improvement.

Use independent, bounded review lanes, starting with:

1. **UI/UX and design, owned by actual Claude agents.** Exercise the app and compare concrete flows with Monkeytype. Inspect visual hierarchy, typography, spacing, keyboard-first navigation, time to first typing, focus/caret/backspace/scroll behavior, error feedback, shortcuts, preferences, results and next-session flow, first-use and returning-user journeys, mobile/touch, accessibility and reduced motion. Include visual evidence, not only source-code opinions. The aim is comparable or better usability and craft with a coherent identity, not a theme copy.
2. **ML, data and evaluation.** Trace what the deployed app actually uses and what remains an offline study. Check data provenance, participant/session splits and leakage, baselines, metrics, calibration, inference features/artifacts, recommendation logic, model/heuristic labels, uncertainty, reproducibility, deployment and opportunities for honest monitoring/retraining. Assess whether a proposed model improves practice decisions over a simpler heuristic. Distinguish timing prediction accuracy from recommendation quality and actual learning gains.
3. **Usefulness for typing improvement and daily practice.** Review the proposed learning mechanism, diagnosis of errors/weaknesses, adaptive practice selection, difficulty, feedback, habit/return loop, motivation without distracting gamification, progress visibility, beginner versus experienced needs, and transfer to real typing. Identify what can be justified now, what needs an experiment, and a feasible evaluation design. Use primary research where claims depend on it; do not present plausible learning theories as measured benefits.
4. **Engineering, reliability, performance, accessibility and privacy.** Inspect typing/input correctness, persistence and migrations, state/session boundaries, device/browser handling, responsiveness/latency, test adequacy, build/deployment reproducibility, data handling, maintainability and security relevant to the actual app. Include product positioning, content clarity and any additional material weaknesses discovered.

Keep initial critiques independent. Then reconcile conflicting findings and run a focused challenge/review of the combined recommendations. Avoid a large number of duplicative workers or blanket maximum reasoning settings.

## Provider, model and effort selection

Use real Claude via Orca for every design/visual/UX judgment and any subsequent design work; a Codex agent prompted to pretend to be Claude does not satisfy this. Use appropriate Codex specialists for technical inspection and verification. Mixed concerns can collaborate, but design conclusions require Claude evidence.

Owen explicitly delegates sensible model and effort choices. Choose from the models actually available in the current runtime, using explicit supported launch/dispatch settings when appropriate. Preserve the coordinator's user-selected model. A sensible allocation is a capable Claude model with high effort for consequential design critique, a strong reasoning model with high effort for ML/evaluation and cross-domain synthesis, and faster models with medium effort for bounded inventory or mechanical verification. Escalate only where difficulty warrants it. Do not silently select maximum effort for every task or change global provider/model configuration. Record actual provider/model/effort receipts rather than inferring effort from numeric telemetry or claiming requested settings were honored without evidence. If Claude is unavailable, report that specific gap and complete independent technical work without fabricating a design review.

## Evidence and expected output

- A concise strengths/weaknesses summary and an honest statement of what the app currently does.
- A ranked findings register with severity, user impact, confidence, reproduction/evidence, file references where applicable, and a concrete recommendation. Separate observed behavior, source-code findings, inference and untested hypotheses.
- Real screenshots or recorded interactions at representative desktop/mobile widths; record the commit, runtime, viewport and tested flows. Label anything not exercised.
- A comparison matrix against Monkeytype focused on relevant user journeys and interaction quality.
- A diagram or clear map of the current data -> model -> inference/recommendation -> practice -> feedback loop, showing missing links rather than inventing them.
- A prioritized roadmap tied to user value and acceptance criteria: immediate defects/polish, a coherent daily-practice vertical slice, and later ML/learning experiments. Include dependencies, effort and uncertainty. No unsupported numerical benefit claims.
- A list of decisions that truly need Owen's input after the evidence is gathered. Do not repeat discovery questions already answered above.

## Earlier reconnaissance: leads to verify, not a substitute for review

The inspected base was main at de69444a6201da96281ca9ad88088904477775a2. Line numbers may drift:

- `typing-app/client/src/app.ts`: static assessment/practice landing, no returning-user practice home; ordinary navigation may omit keyboard declaration/duration and disable calibration; general practice remains default; practice/progress presentation is assessment-heavy.
- `typing-app/client/src/profile.ts`: eligible assessment sentences and pair-observation gates may make recommendations hard to unlock; actual recommendation yield has not been measured. Practice reportedly does not update calibration; profiles are separated by duration.
- `typing-app/client/src/model.ts` and `profile.ts`: Ridge predicts timing; baseline pair timing reportedly drives focus selection and a two-target/one-general pattern. Verify precisely which live decisions use a learned model.
- `typing-app/client/src/style.css`: active typing may compete with controls, instructions, diagnostics and panel borders; assess this visually instead of treating this observation as a design verdict.
- `docs/verification.md`: recorded deployment evidence may lag the checkout. Verify deployed version before equating local and production behavior.
- Existing offline study reports 151 participants / 9,595 transitions, Ridge MAE 61.30 ms versus baseline 67.55 ms, difference CI [-7.76, -4.89] ms. Verify provenance and evaluation design before repeating these figures. These are not evidence of typing improvement.

A candidate direction, not a settled design: a clean remembered workspace, warm-up for new users, a practice profile that can update from practice without contaminating a frozen assessment benchmark, genuinely adapted next blocks, honest explanations of focus, and one-action repeat. Evaluate this against alternatives. Do not simply insert Ridge into the recommendation score without evidence it is suitable.

## Ownership and practical constraints

Workspace: `C:/Users/Owenc/orca/workspaces/TypeForge/typeforge-daily-practice`, branch `feature/daily-practice`. Original checkout: `C:/Users/Owenc/Documents/GitHub/TypeForge`. Keep original checkout and Portfolio isolated. You are not alone on the machine or in the broader project: preserve other agents' edits and services.

Use Orca-created child workspaces when writes or independent build/browser sessions would conflict. Otherwise share read-only source and assign distinct report paths. One owner per live browser session/server/build directory, or use truly isolated sessions and ports. Keep background helpers hidden on Windows. No production deployment, paid services, paid training, new billing setup, external data upload, or broad dependency changes is needed for this critique. Do not modify global tooling or credentials to make a review worker run.

Complete the critique, synthesis and roadmap first and present them to Owen in the TypeForge workspace. The Portfolio assistant and content work continue separately.
