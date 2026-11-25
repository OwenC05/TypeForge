A7 Pilot design: pre-registration draft, power simulation, consent, recruitment and protocol

Read `.omx/plans/model-coach-20261124/common.md` and `plan.md` first. You are worker A7. No port.

## Why

Nobody knows whether practising a personally slow letter pair makes it faster on fresh text. The planned test: for each person, take two qualifying pairs matched on gap size, randomly assign one to practice and hold the other back, then compare the change in each on fresh assessment text. General improvement and regression to the mean cancel because both pairs were chosen the same way. Owen runs it on himself first, then on 15 to 20 volunteers (`PLAN.md` already promises a consented pilot). This task prepares everything except running it.

## Deliverables

1. `docs/pilot/preregistration.md` (a draft, clearly marked not frozen): question and hypotheses; design; eligibility (physical QWERTY, English, desktop); how qualifying pairs are chosen (from plan.md's model: a confident personal gap; until phase B ships, describe the interface, not thresholds); randomisation (seeded, per person, recorded before practice starts); dose (propose, for example, ten practice blocks over at least five days, and justify); outcome (primary: practised-minus-held-back change in mean log interval on fresh assessment text; secondary: first-attempt accuracy on the pair, overall WPM); analysis (per-person difference in differences; participant bootstrap and a mixed model as a check; one-sided or two-sided, say which and why); sample size from the power simulation; exclusions; missing data; deviations policy; what will be published whatever the result.
2. Power simulation `ml/pilot/power_sim.py` (seeded, reproducible, train and validation participants of the 2,000 subset only, read-only data). Estimate the within-person variance of a pair's mean log interval between two measurement occasions from the two halves of each Aalto session, and say why this likely understates between-day variance; inflate it in a sensitivity analysis (for example 1.5x and 2x). Simulate true effects of 3%, 5% and 10% faster on the practised pair for 10, 15, 20, 30 and 50 participants and several amounts of outcome text per pair. Write results to `docs/pilot/power.md` with a table and a plain recommendation.
3. `docs/pilot/consent.md`: plain-language participant information and consent (purpose; what you do and for how long; what is recorded, all stored in your own browser; what you send if you choose to share, an exported JSON file; risks, which are minimal; voluntary participation and withdrawal; contact placeholder). Add a short note for Owen: if results will be published formally or recruitment goes through a university, ethics review may be needed first.
4. `docs/pilot/recruitment.md`: who, how many, how to reach them, a message template, and how to avoid only recruiting fast typists.
5. `docs/pilot/protocol.md`: participant steps day by day, and a numbered list of in-app requirements for the later implementation task (assignment, scheduling, fresh-text assessment from the v2 assessment bank, progress, export format, deletion), each with acceptance criteria.

## Owned paths

`docs/pilot/**`, `ml/pilot/**`. Do not edit app code or other docs.

## Done when

The simulation reproduces from a stated command, the five documents are committed, and `worker_done` follows common.md. Keep each document short and readable by a non-statistician, with technical detail in `power.md`.
