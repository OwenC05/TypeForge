# P4: release-risk and browser verification

Read worker-common.md and the new plan. Own only `docs/implementation/2026-11-16/baseline/release/` and local isolated verification scripts. No production/package/lock edits in this initial task. Use medium effort for bounded checks; escalate only for a reproduced subtle failure. No design/UX judgments: send those to actual Claude through root.

Split into S1 actual dependency audit applicability, B1 available-browser/native-input flows and A1 accessibility evidence inventory. Use Orca for an independent bounded helper if it saves time and separate browser/profile/port ownership is clear. Do not repeat the completed entire design review.

S1: capture fresh npm audit JSON, identify exact vulnerable packages/paths and whether they affect shipped client, dev server or tooling; corroborate current advisory/fix details with official primary sources. Propose the smallest compatible repair and a verification plan, not blanket npm audit fix or broad upgrades. Existing warning was two high findings; recheck rather than assume.

B1: establish which browser engines are actually runnable without global changes. Exercise clean default General first-key start, native middle edit/selection/correction, result/Again, settings persistence and focused failure recovery on available engines. Use generated fixture data only. Report version/commit/build and exact observed cases. No claims for unavailable Safari/Firefox, real phones or physical IME. Do not install browsers globally or modify user browser profiles. Screenshots may be evidence but visual judgments go to Claude.

A1: check programmatic labels/roles, keyboard reachability/focus, reduced-motion/forced-colors where supported and any obvious semantic regression. Real screen-reader speech remains unverified unless actually exercised. Route actionable issues with reproductions and severity, and distinguish existing limitations from new blockers. Do not make cosmetic edits.

Return evidence-backed ranked issues and bounded repair tasks with ownership, affected files and acceptance criteria; commit the evidence. Expected reproduction failures count as evidence; absence of a platform is a documented gap, not fabricated success. Keep root preview 5301 and all Portfolio resources untouched.
