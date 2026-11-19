# Primary evidence for baseline policy

16 November 2026. Bounded P1 evidence helper; three primary papers checked through web browsing. **None establishes that 10 × 30-second tests are necessary or sufficient for personalization, or validates a numerical target-selection threshold.** Ten such tests total 300 seconds (five minutes) of scheduled typing, excluding instructions, breaks and retries; this is arithmetic, not a validated training dose or confidence guarantee.

## Reused evidence and scope

Read the [shared brief](../worker-common.md), [P1 brief](../task-policy.md), current baseline plan, [learning review](../../../../reviews/2026-11-15/learning-review.md), [ML review](../../../../reviews/2026-11-15/ml-review.md), and [research provenance](../../../../reviews/2026-11-15/learning-evidence/research-provenance.md). The prior reviews supply the local clean-sentence filtering, ten-sentence history, coverage and synthetic-probe findings; they were not rerun or independently re-audited here. Historical findings must be reconciled with later implementation repairs rather than treated as current defects. This report adds narrow primary-source checks, not a new broad literature review.

## Primary checks and access depth

### 1. Training schedule: Baddeley & Longman (1978)

*The Influence of Length and Frequency of Training Session on the Rate of Learning to Type*, Ergonomics 21, 627–635. [DOI](https://doi.org/10.1080/00140137808931764); [publisher abstract](https://www.tandfonline.com/doi/abs/10.1080/00140137808931764).

**Access:** publisher's search-indexed abstract read on this date; direct publisher open returned HTTP 403. Full methods/results were not audited. No secondary account substitutes for those missing methods.

**Finding:** four groups of postal workers learned alphanumeric entry on a conventional typewriter, using one- or two-hour sessions once or twice daily. The abstract reports greatest learning efficiency with one one-hour session daily and least with two two-hour sessions. This supports considering distributed training in that setting.

**Limit:** hour-scale skill acquisition differs from collecting a short assessment baseline on a familiar computer keyboard. The abstract cannot settle allocation, total-dose comparability, precision or modern-app burden. It does not compare 30-second tests, validate five minutes, prescribe a minimum test count, or identify a coaching threshold. Resumability is a reasonable product choice; this paper does not determine its schedule.

### 2. Repeated words and context transfer: Yamaguchi & Logan (2014)

*Pushing typists back on the learning curve: Contributions of multiple linguistic units in the acquisition of typing skill*, JEP: Learning, Memory, and Cognition 40, 1713–1732. [DOI](https://doi.org/10.1037/xlm0000026); [institutional author manuscript](https://research.edgehill.ac.uk/ws/files/20172048/YamaguchiLogan_2014a.pdf).

**Access:** PDF text read: abstract; task overview; Experiment 4 method/results, especially manuscript pages 30–37; general-discussion entry. The repository warns that the draft may differ from publication. No independent statistical replication.

**Finding:** trained touch typists learned a relocated key. Experiment 4 contrasted trained words with new words varying the letters before/after the target. Target-keystroke transfer costs depended on those surrounding digraphs, and trained words performed better than new words. The first-keystroke response-time findings were not the same as the target-keystroke findings.

**Limit:** this is altered-key learning, not remediation of a slow pair on an intact keyboard. It motivates distinguishing repeated-word performance from transfer into new words/contexts. It does not quantify TypeForge corpus familiarity, validate the current ranking rule, or supply a minimum number of words, passages, repetitions or baseline tests. Context diversity is a defensible policy safeguard with an unvalidated numerical cutoff.

### 3. Errors and sampling: Dhakal et al. (2018)

*Observations on Typing from 136 Million Keystrokes*, CHI 2018. [DOI](https://doi.org/10.1145/3173574.3174220); [author-hosted primary PDF](https://userinterfaces.aalto.fi/136Mkeystrokes/resources/chi-18-analysis.pdf).

**Access:** full PDF available; focused text read of data collection/procedure (p. 3), preprocessing/performance/error metrics (p. 4), and error/correction findings (pp. 5–6). No dataset download or reanalysis.

**Finding:** self-selected volunteers transcribed 15 sentences, with breaks allowed. Analysis retained completers and excluded error rates above 25%, technical problems and very long interruptions. Unless otherwise specified, analyses included all keystrokes; IKI analyses omitted gaps above 5,000 ms. Corrected and uncorrected errors were measured separately; most participants corrected most mistakes. The authors also note ambiguity when selection/editing deletes multiple characters.

**Limit:** these are observational measurement choices, not experimentally optimized eligibility rules. Fifteen sentences is not ten timed tests. Neither the 25% exclusion nor the 5,000-ms cutoff validates a TypeForge progress gate or error threshold. This paper does not justify excluding every edited sentence or requiring perfect runs. Its volunteer/completer exclusions also limit generalization to all starters and error-prone users.

## Consequences for P1 policy

The following are **product-policy recommendations/inferences**, not experimentally demonstrated TypeForge benefits:

- If P1 selects **10 × 30 seconds**, describe it as a provisional, resumable evidence-collection target. Baseline completion and readiness for a particular recommendation must remain separate. Test count alone does not guarantee target opportunities, diverse contexts or stable estimates.
- Count ordinary mistakes toward participation/progress when the run otherwise qualifies; apply signal-specific eligibility separately. The prior local reviews show why clean-only timing can omit relevant attempts. This helper has not measured how often that occurs among users.
- Repeated text may contribute observations, but repeated-context performance should not establish transfer or independently satisfy a diversity requirement. Distinguish new passages from new words containing the target. The exact repetition/diversity limits remain policy choices.
- Any minimum opportunities, minimum effect, stability window, age expiry or retirement value needs explicit policy identity and boundary fixtures. These three papers supply no validated values for them. Synthetic sensitivity checks can expose brittle rules; they cannot certify scientific adequacy or learning benefit.
- Keep General/manual available when evidence is sparse, incompatible or unsupported. Slow users can produce fewer opportunities in the same scheduled time; ten completed runs must not force a target or a demand for clean retries.

No optimal dose, burden/adherence rate, human recommendation yield, retained improvement or superiority over General/manual is established here. This limited search does not establish that no relevant study exists elsewhere. P1 still owns the concrete counting/threshold contract; current-source coverage probes and independent review remain separate inputs.

## Worker identity and completion evidence

- Task `task_4ed9694ae3a0`; dispatch `ctx_ca293988cb43`; run `run_1aeb00550f39`; worker terminal `term_080eccda-3040-4e56-a185-7d6bee5aef58`; coordinator supplied as `term_5ba278be-b180-421a-8821-fbb9f1a267aa`.
- Live `orca orchestration worker-show --dispatch ctx_ca293988cb43 --json --full` reported accepted input in this workspace and requested/effective launch **Codex / gpt-6.1-sol / high**. Local ancestor `codex.exe` PID **25988** independently exposed matching model/effort flags. These prove client launch configuration, not backend-serving identity. Receipt inspection request ID: `17d31610-a41c-4e40-8653-49451ed31497`; no worker-start mutation request ID was exposed.
- Checkout observed at `c65460b91ab2b310cb51f2f8cd4247d6c9f7c482`; this identifies report context, not a fresh production-source audit. Sole owned output is this file. No production changes, commits, helper workers, UI judgments, private data access, recruitment, refit, benchmark reruns or background services. Validation is citation/access-depth and local-link review; runtime tests are not applicable to this documentation-only slice.
