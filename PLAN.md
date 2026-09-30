# TypeForge implementation plan

Status: local-first recruiter-facing slice implemented, locally verified and independently reviewed, 30 September 2026: code review APPROVE; architecture CLEAR; no unresolved findings in this scope. The engineering portions of milestones 2–4 are verified alongside milestone 1: genuine benchmark/model, browser inference, explainable baseline practice and fresh-retest evidence. This is not public-release approval or completion of the broader platform. The static engineering demo is live on Vercel; accounts/cloud sync, consented TypeForge transfer evaluation and full public-release certification remain open. See [README.md](README.md), [ML documentation](ml/README.md) and the [verification record](docs/verification.md) for commands and boundaries.

### Current local evidence (not final release approval)

Initial independent code/architecture reviews returned REQUEST CHANGES / WATCH. The identified issues have regression-tested repairs; those initial findings remain recorded. Independent re-review returned code-review APPROVE and architecture CLEAR, with no unresolved local-slice findings.

The bundled genuine experiment acquired 2,000 Aalto participants; eligible coverage is 1,386 participants / 5,812 trials / 117,653 transitions. Model `aalto-ridge-83f562c419d5` and report `benchmark-92947653a001` show primary held-out participant-macro timing MAE 61.30 ms versus the selected smoothed-pair baseline's 67.55 ms (151 participants / 9,595 transitions; paired 95% difference interval −7.76 to −4.89 ms). This is prediction evidence only; no TypeForge transfer or training-efficacy claim follows. Full exclusions, splits and secondary results live in the generated benchmark and ML Lab. Current scoped Chromium acceptance and independent local-slice reviews pass; external release gates remain open.

Verification recorded: 49 client tests, TypeScript checking/build and 21 offline Python tests pass; all 682 features and fitted-estimator/exported-browser predictions pass parity at relative tolerance 1e-6. Chromium 155 checks cover the current assessment/practice/retest journey, storage upgrade and failure recovery, missing/malformed-model and missing/mismatched-report states, extreme stored-prediction rejection and real Lab metrics. Regression checks cover fresh bounded Restart calibration, undeclared QWERTY with zero calibration reads and deleted-origin retest Restart becoming a new assessment without a stale origin. Desktop/narrow layout checks (1440px/390px) and a static `/TypeForge/` smoke check pass. Label/focus, timer, reduced-motion and CSS 200% zoom checks do not certify universal accessibility. Firefox/Safari, screen readers, physical-device QA and the consented 15–20-person pilot remain subsequent gates.

Local history database v2 adds a compound index without rewriting v1 records. Old database-v1 binaries cannot reopen it; export before downgrade. Result schema/metric versions remain 1, with strictly validated optional extensions.

## 1. Outcome and boundaries

Build a publicly usable, non-commercial portfolio app for everyday typists. Its centrepiece is a trained model of personal correct-copy timing, with a visible comparison between predictions and later observations. Accounts and cloud history support that experience.

The complete loop is **assessment → personal timing and error profile → targeted practice → fresh assessment → saved progress**. Retain the dark navy and teal identity, with quieter practice screens and accessible native controls.

First-release defaults:

- English, lowercase text and spaces, using a physical keyboard. Ask users to declare QWERTY before enabling model recommendations; browser events cannot reliably identify their layout. Other layouts can use ordinary practice without model claims.
- One 60-second duration for assessments and drills. Start timing on the first character, not on page load or focus.
- Meaningful short sentences; separate versioned practice and assessment banks. Assessment text must never be selected to exaggerate a user's improvement.
- Guest practice works immediately. Email sign-in and private cross-device history are later milestones, not simulated in the local release.
- Predictions concern correct, unedited copying with long pauses excluded. Show errors separately: missing timing evidence is not evidence that a key is easy. Drill effectiveness remains a hypothesis to test.

Leave leaderboards, friends, payments, badges, generative AI, reinforcement learning, mobile typing models and automatic retraining outside this release. None is needed to demonstrate the chosen ML capability.

## 2. Smallest architecture that meets the goal

| Part | Decision |
| --- | --- |
| Frontend | Vite, vanilla TypeScript, semantic HTML and shared CSS. Reuse the existing visual design; no React migration or routing library. |
| Pages | Home, practice, results, progress and ML Lab; account is a later milestone. Use ordinary page URLs and a result ID query parameter. Test and drill share one practice screen; both results prototypes become one screen. |
| Local persistence | IndexedDB for completed results and pending uploads, using a small direct helper. No general storage abstraction. |
| Authentication/database (planned, not provisioned) | Supabase JavaScript SDK, email OTP and Postgres with row-level security. |
| Training | Offline Python with NumPy and scikit-learn; standard-library parsing, ZIP handling and command-line arguments. |
| Inference | A versioned JSON coefficient artifact, bundled with the site and evaluated in TypeScript. No inference server. |
| Deployment | Static engineering demo live on Vercel, linked to GitHub `main`; root `typing-app/client`, Node 24, `npm ci`, `npm run build`, output `dist`, no SPA catch-all. Supabase auth/data remain planned. |

Keep frontend work under `typing-app/client`, offline experiments under `ml`, and SQL migrations under `supabase`. Add files when their behaviour is implemented; do not scaffold unused layers. Pin the chosen dependencies and record the Python environment when implementation begins.

Existing HTML pages are design references, not reliable application logic. Replace random statistics, simulated authentication, duplicate timers and console-only navigation. Remove the unrelated injected geolocation/Blob scripts. Remove obsolete prototype pages from the shipped build once their replacements work; Git retains the originals.

## 3. Measurement, results and persistence contracts

### Typing engine

Use one focused native text input for both modes. Present one sentence at a time; Enter submits a nonempty response and advances to the next sentence without stopping the 60-second clock. A submitted sentence becomes immutable. Timer expiry includes the current partial response in ordinary metrics. Submission gaps count toward session duration but never become within-word latency samples.

Capture actual edits through `beforeinput` and `input`, with physical keydown timestamps for latency. `input` must reconcile the real value even when `beforeinput` is absent or non-cancelable. Do not capture document-wide typing or anything entered in account fields.

Preserve normal Backspace, word deletion and selection replacement within the current sentence. The prompt has fixed character indices: an insertion replacing `[start,end)` records each attempt against `target[start+j]`. First-attempt records stay attached to those target indices; shifting existing characters creates neither new attempts nor new timings. These are positional copying metrics, not an inference about intended words. If an edit cannot be reconstructed, preserve the visible response but mark diagnostics unavailable.

Block paste/drop for scored practice; unexpected bulk edits, composition or untracked edits make the run ineligible for scored assessments and the affected sentence ineligible for model data, with a restart option. Ordinary shortcuts outside the typing field continue working.

Use explicit idle, running, completed and aborted states. A `performance.now()` deadline controls the run; timer callbacks only refresh the display. Check it before every edit, Enter submission and run-state transition: a keydown before the deadline whose text commits afterward is rejected. Cancel late `beforeinput` where possible; otherwise restore the last accepted value on `input`. Freeze metrics at the deadline even if the completion callback is delayed. A late Enter cannot turn the unfinished final sentence into submitted model data.

Focus loss does not pause the clock; it flags the run as interrupted and the active sentence as ineligible for ML. Earlier submitted sentences are not retroactively invalidated. Restart cancels the prior run; stale callbacks cannot affect its replacement. An auth-subject change aborts an active run. Aborted runs do not enter saved progress or future model history.

Metric version 1:

| Metric | Definition |
| --- | --- |
| WPM | Sum of positional character matches in submitted responses and the active partial response, including spaces, divided by five and elapsed minutes. A completed timed run uses 60 seconds. Excess characters receive no credit; no edit-distance realignment. |
| Attempt accuracy | Correct inserted-character attempts divided by all inserted-character attempts. Correctness is assessed against the target position at insertion. Deleted mistakes remain in the denominator; deletion itself is not a character attempt. |
| First-attempt key errors | Wrong first entries at target positions divided by first-entry opportunities. Repeated corrections do not create independent opportunities. |
| Correction effort | Deleted-character count, reported separately from errors. |
| Correct-copy timing | Keydown-to-keydown intervals for consecutive lowercase letters within a word, retained only after the sentence passes the shared model-eligibility rule below. Never bridge a sentence boundary. |

Before any attempts, show accuracy as unavailable. Interrupted or invalid runs do not update personal bests or headline trends; keep completed ones visibly labelled in history. Independently eligible submitted sentences may still contribute to the model; affected sentences and the unfinished final sentence cannot. Pause filtering never shortens displayed session duration.

### Minimum types and database surface

- `SessionResult`: UUID, schema/metric versions, completion time, settings, source assessment/target, quality flags, headline metrics and per-second chart samples. Its ordered sentence summaries retain prompt ID/text, completion/eligibility flags, per-key attempt counts and per-pair log-latency counts/sums. Save model version and prediction counts/log sums for comparable observed occurrences; do not recompute historical predictions using today's model or history.
- `TypingEvent`: temporary in-field key/edit/focus events used by the engine. Normal cloud history stores derived results, not an indefinite raw-keystroke archive.
- `ModelArtifact`: model/feature versions, supported task, ordered features, coefficients/intercept, population defaults, eligibility limits and validation-derived residual bounds.

Use one `sessions` table: `user_id`, `id`, `completed_at`, server `created_at`, `schema_version`, nullable `deleted_at`, and JSONB `payload`; primary key `(user_id, id)`. Reference Supabase Auth for ownership. Database constraints enforce supported schema/metric versions, required JSON types, nonnegative headline counts/speed, accuracy in `[0,100]` or null, and bounded nested arrays. Cap uncompressed JSON text at 1 MiB; define shared limits with the engine so valid runs are not silently rejected. A deletion marker instead has a null payload. Reject invalid responses again in the browser before rendering or profiling; render saved text through text nodes. Scores remain personal practice records, not verified competition scores.

Enable RLS and grant authenticated users SELECT and INSERT for their own active results; grant no ordinary UPDATE or DELETE. Readers can also retrieve their own deletion markers. Restrict insertable columns so clients cannot supply deletion/server timestamps. Never ship service-role credentials. Keep active payloads immutable and retry insertions with duplicate-ignore behaviour. A result ID resolves only within the current guest/account scope.

Provide one narrow SQL RPC, `delete_session(id)`, which verifies a non-null `auth.uid()` and atomically inserts or updates only that owner's `(user_id,id)` deletion marker, setting `deleted_at` and clearing the payload. Allow minimal markers without completion/schema fields. Create the marker even when an upload has not arrived yet, so an in-flight first upload cannot defeat deletion. Because callers have no UPDATE grant, use a security-definer function with a fixed empty search path, fully qualified names, explicit ownership checks and execution granted only to authenticated users. Retain the small marker to prevent old uploads from recreating deleted history. No custom API server is required.

Save locally before uploading. Bind ownership when a run starts. Guest results move into an account only through an explicit “Save these results to this account” action that atomically binds the selected records to the captured account in IndexedDB. Cancel the operation if auth changes before that transaction commits. Pending account A records retain A's ownership after sign-out or sign-in as B. Ignore stale responses from another account; never merge account caches.

Sync on sign-in, completion, reconnect and manual retry. Deduplicate by owner and session ID; show pending/error states. A lost upload response cannot create a second result. Apply server deletion markers to both local results and pending uploads, and never enqueue downloaded records for upload. Refresh statuses for cached IDs on reconnect before using them in a new profile. Invalidate outstanding history reads when a deletion completes so a stale response cannot restore the display. Cloud deletion requires connectivity; local-only guest results can be removed immediately.

Storage failure leaves the current result visible with an export option. Clearly label exports containing only cached history when offline. No offline deletion queue or realtime subscriptions; the app does not promise to reload offline without a service worker.

## 4. ML experiment and browser delivery

### Data and benchmark first

1. Use Aalto 136M as the initial research source, retaining its attribution and non-commercial restrictions. Implement our own pipeline; do not copy another project's model/code under an assumed permissive licence. Keep raw archives and derived user records out of Git.
2. Start with a deterministic 2,000-participant subset; publish the seed, source checksum and participant manifest. Stream records rather than expanding the whole archive into memory. Scale to 10,000 participants only after the pilot pipeline works and learning curves justify more data.
3. Group by participant/trial and sort by press timestamp, not row or release order. Apply the same sentence and transition eligibility rules as the browser. Audit how public key codes, shift/case, repeat events and layout metadata map to those rules before training; exclude ambiguous records rather than assuming they match. Report participant, sentence and transition coverage, with exclusions by participant speed so filtering does not silently remove struggling users.
4. Make fixed participant-disjoint 70/15/15 train/validation/test partitions. Reserve a separate deterministic 20% of prompt IDs from fitting and tuning for an unseen-text evaluation. Exclude these prompt trials from all calibration histories and from fitting/tuning target rows. Keep all events of a trial together. Fit defaults and transformations on training data only. Develop the baseline and candidate on train/validation data, then evaluate both on the locked test set once.
5. In both pipelines, use the latest **10 eligible, completed general-assessment sentences** preceding the sentence being predicted. Freeze their aggregate counts and log sums at that sentence's start; include earlier submitted sentences in the current assessment, never the active sentence or future events. Load prior saved history once at run start, so mid-run cloud downloads cannot rewrite its context. Exclude targeted drills. Persist sentence order and store the exact prior-history snapshot in volunteer research exports. Aalto's successive sentences support within-session prediction, not evidence of improvement across days.

The shared eligibility rule requires a submitted sentence that exactly copies its prompt on the first pass: no wrong insertion, deletion/replacement, held-key repeat, composition, untracked edit or focus interruption. If any condition fails, discard that sentence's timing observations and predictions from model evaluation/history, while retaining its ordinary practice metrics. An unfinished final sentence is ineligible. Public trials must satisfy every condition recoverable from their logs; document remaining instrumentation differences rather than claiming identical capture.

Within an eligible sentence, retain consecutive lowercase letter pairs within a word with finite, increasing press timestamps and `0 < interval <= 5000 ms`. Spaces and punctuation break a pair; do not join across them or across excluded intervals. Discard nonpositive/malformed timings and flag the trial for audit. The 5-second cutoff is a declared noise filter, not a physiological threshold; report its effect. Public prompts may have mixed case/punctuation; use the same lowercase within-word subset and evaluate the simpler TypeForge task separately. Restrict to declared QWERTY users where the source supports that distinction. If layout cannot be established, label the source cohort accordingly and make TypeForge validation decisive.

### First trained model

Train Ridge regression on **log milliseconds**, using a sparse design matrix, `StandardScaler(with_mean=False)` and Ridge's `lsqr` solver. Avoid materialising a dense per-keystroke one-hot matrix. Use a fixed feature set:

- One-hot intended letter pair (`aa` through `zz`).
- Word length and normalised position of the pair's second character. A word is a maximal `[A-Za-z]+` run; use its full length and zero-based character index divided by `length - 1`. Only lowercase-to-lowercase pairs produce samples.
- Prior user mean log interval and `log1p` observation count.
- Prior user/pair mean log interval and `log1p` pair count.

For missing historical feature values, an unseen user/pair uses the user's historical mean; an unseen user uses the training population mean. Zero counts identify those substitutions. Pair categories always use the same fixed `aa`–`zz` ordering. Historical values exclude the current sentence and every later event. Do not add demographics, inferred finger use, external language models or a word-frequency service in v1.

Compare against population mean-log latency, user historical mean-log latency, a smoothed user/pair estimate, and the same Ridge model without personal-history features. The smoothed estimate is `(pair_log_sum + k * user_mean_log) / (pair_count + k)` over the same ten-sentence window; user means weight observations equally and fall back to the training population mean. Select Ridge alpha from `0.1, 1, 10, 100` and baseline prior strength `k` from `1, 5, 20` using validation participant-macro MAE in milliseconds. Final test data never selects a model or parameter.

Report participant-macro MAE in milliseconds, mean absolute log error and results by speed/history amount. Define warm history as at least one prior eligible sentence; report cold start separately. Bootstrap differences by participant, retaining all a participant's trials together. Use exactly the same observations for every candidate and publish the benchmark even if a simple baseline wins.

Pair ranking is a secondary diagnostic: compare mean predicted and mean observed **log** times for the same occurrences, using pairs with at least eight observations and participants with at least five qualifying pairs. Report coverage, participant-bootstrap uncertainty and sparse cases. Do not turn unstable correlations on a handful of pairs into a promotion gate. Public-data ranking cannot establish that practising a recommended pair improves typing.

Select the strongest historical baseline on validation participants and freeze that choice. The model earns a public-data improvement claim only if held-out warm-history MAE improves over that baseline and the participant-bootstrap 95% interval for `model MAE - baseline MAE` lies below zero. Repeat that comparison on locked consented TypeForge runs before claiming predictive improvement in this interface. Publish point estimates and uncertainty when the sample is inconclusive.

Building a trained candidate, reproducible benchmark and working browser inference completes the engineering milestone. Positive scientific results are a separate gate. An unvalidated candidate may run in the consented pilot and appear in an explicitly experimental prediction comparison; use the labelled historical baseline for default recommendations until the TypeForge evidence supports promotion. If the baseline wins, report that result and keep its recommendations. This preserves an honest ML showcase without blocking the pilot needed to evaluate it.

Use validation errors and data coverage to guide changes. Once final-test errors have been inspected for iteration, that cohort becomes development data and the next promotion claim requires a fresh locked holdout. A small gradient-boosted challenger is a later experiment only if the analysis indicates interactions the linear model misses. A larger model does not automatically justify a backend service.

### Artifact and inference

Fold fitted scaling into the exported coefficients: divide each weight by its fitted scale and retain the intercept because this scaler does not subtract means. Browser inference becomes `exp(intercept + dot(weights, features))`. Label this “predicted typical transition time”; exponentiation of a log prediction is not an unbiased arithmetic mean.

For individual transitions, retain validation residual quantiles `q10` and `q90` of `log(observed) - predicted_log`. Display the approximate range `[exp(predicted_log + q10), exp(predicted_log + q90)]` only as a range for an individual correct transition, with held-out coverage reported. It is not a confidence interval for a pair average or an expected benefit from practice. Pair summaries show geometric-mean point estimates and counts; show population/baseline status when history is sparse and no model claims for unsupported tasks.

One shared golden-fixture file must verify Python/TypeScript feature vectors and predictions, including zero history, unseen pairs, mixed-case/apostrophe tokenisation and nonzero feature means that would expose an incorrect intercept adjustment. Require relative prediction agreement within `1e-6`. Reject incompatible versions, malformed shapes and non-finite output; use the labelled historical baseline when the artifact cannot load.

Bundle one versioned artifact with each frontend release and an explicit experimental/promoted status. Record data provenance, configuration, environment, metrics and limitations alongside it. Retraining and promotion are explicit offline commands followed by a normal release; no registry, scheduled training or inference API.

## 5. Coaching and product behaviour

- Start with one assessment. Show WPM, accuracy, observed errors and a timing profile with distinct observed/predicted/insufficient-data states. Label timing suggestions as a practice focus, not a diagnosis of the user's weakest skill. Offer another general assessment when evidence is sparse.
- Create an original, versioned bank of at least 120 short sentences: 80 for practice and 40 reserved for assessments. Keep the actual displayed text in the session result for reproducibility. Avoid consecutive repetition and exclude the initial assessment's passages from its retest.
- Choose one supported target pair from the ten-sentence history: at least eight valid timing observations, present in at least three practice-bank sentences. With history frozen when choosing the drill, score each pair by `max(0, predicted_mean_log_time - user_mean_log_time) * bank_occurrence_count`; average predictions over that pair's word contexts in the fixed practice bank. Use the promoted model, otherwise the selected historical baseline, and label the source. Break ties alphabetically. This is a transparent product heuristic, not a demonstrated optimal practice policy. If no target has positive score, offer general practice. Show observed errors separately.
- Build a 60-second drill with two target-bearing sentences followed by one general sentence, repeating with varied text. If no pair qualifies, offer general practice. The threshold and mixing ratio are product defaults to evaluate, not research-established optima.
- Keep detailed predictions out of the user's way while typing. Results show the selected target, evidence count and subsequent observations. For prediction comparisons, generate predictions before each sentence using its actual word contexts, retain only occurrences that later pass eligibility, and aggregate observed/predicted log times over those exact same occurrences. Do not compare the practice-bank target score with a different set of observed sentences. Avoid posture/finger diagnoses and unsupported “improved by X%” messages.
- Retest on fresh assessment-bank passages. Report comparisons only for matching settings, corpus and metric versions; keep drill scores separate. Show a rolling five-assessment trend alongside individual runs. Passage variation remains a limitation until the pilot quantifies it.
- Progress shows actual history, supported timing targets and prediction quality. Fetch history in pages of 100; use the newest ten eligible general-assessment sentence summaries for the model profile, ordered by run time and within-run index. Fetch older pages only if needed, and expose cold/sparse history if fewer exist. No separately mutable cumulative counters or profile table. Device clocks may affect cross-device ordering; preserve each device's within-run order and document this limitation.
- Provide labelled controls, visible focus, non-colour error cues, reduced-motion support and readable contrast. Announce start/completion accessibly without reading every timer tick. Charts include equivalent text summaries; simple SVG/HTML is sufficient.

## 6. Milestones and acceptance checks

Milestone 1 and the local engineering portions of milestones 2–4 have passing checks and independent review, as summarized above. Milestone 7 has verified portfolio documentation, actual screenshots and public static-demo deployment; its full platform/public-release gates are not complete. Milestones 5–6 and public-release service/device gates remain unfinished. The table retains the broader roadmap and its completion gates.

| Order | Deliverable | Completion gate |
| --- | --- | --- |
| 1 | Working measurement slice: shared engine, real results, local save and original sentence banks. | A complete assessment survives reload; displayed metrics derive from the actual edits. |
| 2 | Reproducible data audit and baseline benchmark. Can run alongside milestone 1. | One documented command produces a dataset-quality report and validation-set baseline metrics without leakage; final test remains locked. |
| 3 | Trained candidate, evaluation report, JSON export and browser inference. Depends on 1–2. | Reproducible training, locked public-data report and Python/browser parity pass; measured performance and experimental status are visible. |
| 4 | Targeted drill, fresh retest and progress loop. | Every result, target and comparison traces to recorded sessions; no sample statistics remain. |
| 5 | Email accounts and reliable private cloud history. Can start after 1. | Two-device sync, retry/deduplication, deletion and account-isolation checks pass. |
| 6 | Consented volunteer pilot and model decision. Depends on 3–5. | Locked TypeForge evaluation is published; promote the candidate only if evidence supports it, otherwise retain labelled baseline recommendations. |
| 7 | Portfolio documentation and public release. | Measurement, access control, account email delivery and evidence-appropriate product wording pass review. Both model outcomes can ship. |

Keep tests small: Node's built-in assertions/test runner for pure TypeScript-compatible logic, Python `unittest`/assertions for preprocessing/export, one database ownership check using two accounts, and a documented real-browser acceptance pass. Add a test framework only when this stops covering a concrete failure.

Required scenarios:

- Perfect/all-wrong input, corrected mistake, partial final word, spaces, word deletion and range replacement. `c`, `x`, Backspace, `a`, `t`, Space against `cat ` leaves four correct characters and 80% attempt accuracy. Against `cat`, typing `ct` then inserting `a` in the middle leaves three correct characters, 2/3 attempt accuracy and no eligible model timings.
- Enter submission, empty Enter, deadline boundary, restart, delayed/background timer, blur, paste, composition and typing after completion. A pre-deadline key with a post-deadline commit changes neither the frozen metrics nor accepted input. None may fabricate timing samples or extend a run.
- Empty/sparse history, unseen pair, unavailable model, feature-version mismatch and Python/browser parity. The same synthetic sentence stream must produce the same eligibility, ten-sentence history and aggregates in both pipelines.
- Deterministic dataset splits; no participant overlap or held-out prompts in fitting/history; changing a future event cannot change an earlier feature vector. A corrected or interrupted sentence never enters model history; discarded observations also discard their paired predictions.
- Offline save, quota failure, lost upload acknowledgement and duplicate retry. Deletion before the first upload, during an in-flight upload and after a lost acknowledgement must survive subsequent retries on either device. Display an actionable error or export option on failure.
- A→sign-out→B with queued writes and delayed reads; A's records remain isolated. Auth changes during a run or guest import cannot reassign its owner. Direct unauthenticated/cross-user writes, malformed own-account payloads and attempts to set deletion timestamps must fail at the database.

For the pilot, target 15–20 consenting volunteers over three visits as an initial feasibility sample. Capture designated research runs in pseudonymous JSON exports, including in-field event/edit history, exact pre-sentence history snapshots and model predictions; ordinary users are not automatically enrolled in training. State the purpose, stored fields, retention period and withdrawal route before collection; keep consent records separate from event exports.

Use first visits for integration checks and identifying task mismatch. Freeze preprocessing, candidate/baseline selection and the evaluation procedure before collecting/unlocking later-visit runs. This is a within-person, later-visit transfer check, not a claim of unseen-person validation. No tuning on those held-out outcomes; if they guide a change, collect a fresh holdout for the revised claim. Report eligible participants/sentences/pairs, recruitment limits and uncertainty. An inconclusive 15–20-person pilot is a valid result.

A subsequent efficacy study should compare equal-duration adaptive and general practice, with fresh counterbalanced passages, accuracy alongside speed, and a delayed follow-up. Determine its sample size from pilot variability before making superiority claims. That efficacy study is not a prerequisite for honestly releasing an experimental predictive coach.

The public static demo now uses Vercel rather than the originally proposed GitHub Pages host. The planned full-platform backend remains Supabase, with email OTP delivered through Resend SMTP using a verified sending domain. Supabase's built-in mail service is not sufficient for arbitrary public sign-ups. Working production email, tested RLS/deletion and a published TypeForge evaluation are full-platform launch prerequisites; a positive model result is not. Configure auth redirect URLs for the deployed base path and verify OTP expiry, resend behaviour and sign-out. Service configuration and any domain purchase belong to later implementation work.

Ship a README with setup/demo instructions, an architecture diagram, actual screenshots and a model report with baseline comparisons and limitations. CI runs type checking, the small checks and the static build; full dataset training remains manual. A failed release can roll back the static bundle and its paired model artifact together. Use existing auth/database logs and visible sync failures before introducing monitoring services.

## 7. Research and implementation references

- [Dhakal et al., 2018: 136M dataset and usage terms](https://userinterfaces.aalto.fi/136Mkeystrokes/) — initial desktop data; preserve its collection and licensing boundaries.
- [Original 136M paper](https://userinterfaces.aalto.fi/136Mkeystrokes/resources/chi-18-analysis.pdf) and [capture code](https://raw.githubusercontent.com/aalto-ui/136m-keystrokes/master/public/javascripts/typingtest.js) — event ordering, timing definitions and limitations of error reconstruction.
- [Pinet et al., 2022](https://link.springer.com/article/10.1186/s41235-022-00424-3) — linguistic context and proficiency affect timing; observational habits do not establish training effects.
- [Williams et al., 2026: Typability Index](https://link.springer.com/article/10.3758/s13428-025-02877-y) — control passage difficulty; population text prediction differs from personal coaching.
- [Feit et al., 2016](https://userinterfaces.aalto.fi/how-we-type/) — accommodate varied typing styles without inferring unobserved finger movements.
- [Baddeley and Longman, 1978](https://gwern.net/doc/psychology/spaced-repetition/1978-baddeley.pdf) and [Yechiam et al., 2003](https://yeldad.net.technion.ac.il/files/2016/12/type.pdf) — distinguish practice efficiency, retention and transfer.
- [Soukoreff and MacKenzie, 2003](https://www.yorku.ca/mack/chi03.html) — distinguish corrected errors, remaining errors and correction operations.
- [MDN: beforeinput](https://developer.mozilla.org/en-US/docs/Web/API/Element/beforeinput_event) — not every native edit is cancelable or produces this event; reconcile the actual input value.
- [scikit-learn Ridge](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Ridge.html) — regularised linear model and coefficient export.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless) and [SMTP requirements](https://supabase.com/docs/guides/auth/auth-smtp) — managed accounts with enforced row ownership and working public email delivery.
- [Vite multi-page builds](https://vite.dev/guide/build.html#multi-page-app), [GitHub Pages deployment](https://vite.dev/guide/static-deploy.html#github-pages) and [Resend/Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp) — proposed deployment path.

Ponytail rule for later additions: add complexity when a measured limitation demands it. The first release already has substantial work in reliable measurement, supervised learning, evaluation and private cross-device persistence.
