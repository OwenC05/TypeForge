# Architect review 2

Native role: `architect`, task `/root/review_breakdown_architect`. Verdict: **ITERATE**, 15 November 2026. This is a coordinator-preserved record of the completed read-only native review, not execution authorization. No new browser/performance/user tests.

Reviewed SHA256:
- PRD: `315ea3ca6b28dd8d10c5b55f8275e0888d19f7f46dd620ba948159918b0da8ef`
- Test specification: `9df6b56cc2fabf7f5348a54eb0684f85706c566fbc7ebec2d32d076c25d4722d`

## One blocking correction

The proposed Undo contract counts replay removals as deleted characters without adding insertion attempts. Current storage validation bounds deletedCharacters by MAX_ATTEMPTS (16,384): `engine.ts:7-9`, `storage.ts:49-52,127`. Twenty-eight removals of a restored 600-character response would total 16,800 while original insertion attempts remain 600. This is a counterexample to the proposed contract, not a reproduced current-app defect. A replay-operation cap alone does not cover prior deletions and ordinary deletion after replay restoration.

Revision must select a finite version-2 deletion bound or a pre-admission guard preserving the existing bound; define an honest bounded fallback preserving a valid retained snapshot before exceeding it; never clamp/discard counts or defer failure until saving; preserve v1 validation; test below/at/over limits with replay, ordinary deletion after restoration and substantial prior deletions. Assert exact counters, fallback and successful strict validation/export. This remains separate from the independently deliverable UI increment.

## Resolved earlier blockers

Claude-owned coherent layout prototypes; native geometry/content/cue proof; LF/CRLF repair and paired profiling; separate versioned Undo work; bounded optional reads with readiness/race guards; exact assessment calibration isolation; concrete Stage 2A policy prerequisite with General/manual-only valid fallback; deferred export redesign. No further broad audit required.

## Nonblocking cautions

The 8 ms aggregation budget is cooperative yielding between bounded operations; JavaScript cannot preempt one validation/serialization operation. Record single-operation overshoot rather than promising a hard wall-clock ceiling.

Metric version 2 is a reasonable conservative compatibility boundary. Its cost is cold calibration and unavailable cross-generation retests even without Undo. Separate cohorts and immutable old records correctly expose that consequence; a version change alone does not prove replay correctness.

## Deliberation

**Antithesis:** retain conservative Undo exclusion with a truthful notice and deliver polished General/manual practice first; native history reconstruction adds complexity and cohort fragmentation.

**Tradeoff:** familiar editing continuity versus trustworthy reconstruction, finite accounting and compatibility.

**Synthesis:** independent UI release and honest notice; Undo only after bounded accounting and real-browser replay fixtures pass. Adaptive practice remains conditional on its separately reviewed policy contract.

**Next gate:** minimal Planner correction, exact-byte Architect re-review, then a separate Critic.
