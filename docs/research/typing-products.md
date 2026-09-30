# Monkeytype and keybr research for TypeForge

Reviewed on 30 September 2026. Implementation is paused for this research; recommendations below are proposals, not completed features or changes to the agreed plan.

**Recommendation:** learn from Monkeytype's typing flow and keybr's guided progression. TypeForge needs to make the next useful exercise obvious, explain why it was selected, and check progress on separate assessment text. Adaptive practice, weak-key statistics and prediction already exist in these competitors. Adding an ML label would not establish a useful difference.

## Scope and evidence

This is a broad product and implementation review, not an exhaustive test of every setting. Evidence covers onboarding, typing, errors, results, practice selection, progress, customization, accessibility, privacy, monetization and technical implications.

- **Observed:** signed-out Chromium sessions on the live sites, including a Monkeytype ten-word test, its practice dialog and settings; keybr's tutorial, guided lesson, settings, guest profile and account information. Desktop inspection used a 1440 × 1000 viewport; narrow-layout checks used 390 × 844.
- **Documented:** official help, policies and public source. Monkeytype displayed version **v26.32.0**. Keybr source was inspected at commit [`05a37bc5265f65ff538c59c613db29442f345d51`](https://github.com/aradzie/keybr.com/tree/05a37bc5265f65ff538c59c613db29442f345d51). Repository behavior can differ from deployed behavior; mutable source links are dated by this review.
- **Assessment:** our interpretation of the evidence and its relevance to everyday typists. Statements about confusion, motivation or transfer are design hypotheses unless explicitly established otherwise.
- Automated keyboard events exercised the interfaces and deliberate mistakes. Displayed speeds in screenshots are **test artifacts**, not human performance, learning gains or a fair benchmark between sites.
- No accounts were created, messages sent, purchases made or leaderboard entries submitted. Signed-in synchronization, paid features, account deletion, long-term retention and assistive-technology operation were not tested. Necessary-only consent options were selected where offered. No privacy-compliance or network-tracking audit was performed.

## Product comparison

The assessments in this table describe the apparent emphasis of each product, not capabilities missing from the other.

| Dimension | Monkeytype | keybr | TypeForge implication |
| --- | --- | --- | --- |
| Primary experience | A configurable test surface with immediate typing feedback. [Overview][m-readme] | Guided lessons select a focus and expand the available alphabet. [Selector][k-guided] | Keep quick entry, then provide a clear next action. |
| Strongest audience fit | Assessment: appealing to fluent typists who enjoy refining performance and configuring their environment. | Assessment: appealing to learners who want the application to choose what comes next. | Serve everyday typists without assuming they already know how to design practice. |
| Practice content | Time, word-count, quote, custom and open-ended modes. [Settings metadata][m-metadata] | Guided, common-word, book, custom-text, code and number lessons. [Modes][k-modes] | Start narrow; everyday text is useful, but it is not an exclusive differentiator. |
| Personalization | Missed/slow-word practice and adaptive weakspot mode. [Practice][m-practice], [weakspot][m-weakspot] | Per-key statistics select focus letters and govern unlocking. [Selector][k-guided] | Explain and evaluate our own selection policy against simple alternatives. |
| Progress | Account history with configurable filters and export. [Account][m-account], [filters][m-filters] | Detailed guest statistics, with cloud history after sign-in. [Profile][k-profile], [account][k-account-live] | Preserve useful guest history and default to comparable assessments. |
| Difficulty control | Many modes, thresholds and error-handling options. [Settings][m-settings] | Target speed, starting letters and progression options. [Lesson settings][k-settings] | Offer useful defaults before exposing advanced controls. |
| Keyboard support | Extensive language and keymap configuration. [Settings metadata][m-metadata] | Language, layout, geometry and layout emulation. [Layouts][k-layouts], [keyboard settings][k-keyboard-settings] | State our supported task clearly; broad layout coverage is later work. |
| Community | Leaderboards and community/support links are visible. [Live site][m-live] | High Scores and Multiplayer are visible navigation destinations. [Live site][k-live] | These may support repeat use, but are outside our first release. |
| Business model | Optional ads, donations and merchandise. [Privacy][m-privacy], [support][m-support] | Advertising plus a one-time premium purchase. [Account][k-account-live] | A portfolio MVP does not need either monetization system. |

## What Monkeytype does well

### Typing and visual hierarchy

**Observed:** the typing prompt is the workspace. Typed characters are displayed in place, with an obvious caret and immediate error treatment. Mode controls sit above it and restart shortcuts below it. The result screen puts WPM and accuracy ahead of secondary statistics. [Live site][m-live]

**Assessment:** this reduces the eye movement between a passage and a separate input field. The restrained layout and quick repeat loop are worth learning from. Our current two-area practice screen asks the user to divide attention between the target and their response.

### Breadth without requiring configuration first

**Documented and observed:** users can begin with defaults, then change test content, duration, punctuation, numbers, presentation and input behavior. Searchable keyboard commands provide another route to settings. [Settings][m-settings]

**Assessment:** the good pattern is progressive disclosure: a small surface for the common task, substantial control when requested. TypeForge should borrow the organization principle before adding dozens of settings.

**Documented accessibility-relevant options:** Funbox includes text-to-speech and limited-lookahead modes displaying fewer upcoming words. These complement display customization, although they do not establish screen-reader compatibility or accessibility conformance. [Funbox implementation][m-funbox]

### Detailed feedback and useful follow-up practice

**Observed:** the result screen includes speed, accuracy, raw speed, character categories, consistency and a graph. Additional actions expose history/replay and follow-up practice. The practice dialog offers missed words, their preceding-word context, and slow words. [Live results and practice][m-live]

**Documented:** missed-word selection is weighted by errors; slow-word selection uses roughly the slowest fifth of completed words. Separately, weakspot maintains character timing averages, penalizes incorrect entries, and chooses a difficult word from sampled candidates. These inspected paths are explicit adaptive heuristics. [Practice implementation][m-practice], [weakspot implementation][m-weakspot]

**Assessment:** “practise the thing that just went wrong” is a concrete, understandable action. We should not claim that competitors merely display statistics or offer random practice.

### Comparable history and user control

**Documented:** the account interface provides charts, sortable results and CSV export. Filters include mode, language, difficulty, punctuation, numbers, dates, tags and special modes; users can filter to their current settings and save filter presets. [Account][m-account], [filters][m-filters]

**Assessment:** this is stronger than a single undifferentiated WPM trend. TypeForge can make comparison rules automatic and visible without claiming Monkeytype cannot compare like with like.

## Where Monkeytype is weaker or creates trade-offs

| Finding | Evidence and boundary | Assessment for TypeForge |
| --- | --- | --- |
| A powerful tool still requires practice decisions | Many training and behavior choices are available; the inspected result flow does not impose a complete assessment–practice–fresh-assessment sequence. [Practice][m-practice], [settings][m-settings] | A newcomer may need more help choosing an exercise, its duration and when to reassess. Give one recommended next step with an optional alternative. |
| Important actions are represented by icons | Several navigation controls exposed icon glyphs rather than descriptive names in the captured accessibility tree; result actions had useful accessible names/tooltips. [Live site][m-live] | Compact controls reward familiarity but can slow discovery. Use visible text for the primary action and meaningful accessible names everywhere. This is an audit concern, not a conformance verdict. |
| Short, familiar tests have limited transfer claims | The documented default English bank contains 200 common words. [About][m-about] | Familiarity and short bursts can improve a score without establishing improvement on punctuation, unfamiliar prose or ordinary work. Preserve task-specific labels and broader transfer assessments. This is not evidence that such tests are useless. |
| Statistics need interpretation | WPM, raw speed, character categories and consistency have distinct definitions. [About][m-about], [statistics][m-stats] | More metrics can create false precision if the next useful action remains unclear. Show the primary outcome first and explain details on demand. |
| Documentation and implementation can diverge | About describes the raw graph as momentary; the inspected source uses cumulative raw history and a separate burst history, including in the result renderer. [About][m-about], [statistics][m-stats], [renderer][m-renderer] | Do not repeat a graph explanation without checking the deployed version. Keep TypeForge metric definitions beside their tested implementation. |
| Some settings trade accessibility for speed | Quick-restart options explicitly warn that normal Tab navigation can be disabled. [Settings][m-settings] | Keyboard shortcuts are valuable, but must not unexpectedly take away standard focus navigation. |
| First-use consent and promotion interrupt the minimal surface | Two consent layers and a merchandise banner appeared in this session. Ads can be disabled in settings; these observations are region/session dependent. [Live site][m-live], [privacy][m-privacy] | Keep TypeForge's first useful action free from unrelated decisions. Optional monetization is a strength of user control, while its surrounding UI still adds friction. |
| Saved history asks for sign-in | The guest result screen prompted sign-in to save the result. [Live site][m-live] | Our local guest history is useful. Do not turn account creation into a prerequisite for discovering progress. |
| Personalization is not evidence of training efficacy | The inspected selection algorithms adapt to performance; they do not themselves establish transferable benefit. [Practice][m-practice], [weakspot][m-weakspot] | A smarter prediction and a better learning intervention are separate claims. This applies equally to TypeForge. |

The reviewed official material did not supply a controlled efficacy comparison for these practice policies. That is a limit of this review, not a claim that no such research exists.

## What keybr does well

### A concrete learning path

**Documented:** guided lessons begin with six frequency-ordered letters by default. The selector chooses a focus among eligible keys and progressively opens the remaining alphabet. A target-speed setting controls progression; another option requires earlier keys to remain above target. [Guided selector][k-guided], [settings][k-settings], [recovery option][k-recover]

**Observed:** the practice screen showed the current key, calibration status and alphabet progression. Completing the inspected lesson immediately produced another lesson and an unlock notification. [Live practice][k-live]

**Assessment:** the learner receives an answer to “what should I practise now?” without interpreting a dashboard. Visible progression can make small improvements concrete. Optional explanation is better than hiding the reason for the exercise.

### More varied content than its reputation suggests

**Observed and documented:** natural-word preference was enabled. Guided generation uses dictionary words where possible and falls back to generated words under restrictive letter sets. Other modes include books, custom text, code and numbers. [Natural-word setting][k-natural], [dictionary selection][k-dictionary], [modes][k-modes]

**Assessment:** the constrained alphabet creates focused repetition while broader modes provide an escape from it. Criticizing keybr as “only nonsense words” would be inaccurate. TypeForge can prefer coherent sentences, but needs a more specific advantage than real words or realistic content alone.

### Feedback at the level of the learning task

**Observed:** the guest profile exposed per-key speed and error information, an overall trend, a practice calendar and accuracy streaks. It offered data download without requiring an account. [Profile][k-profile-live]

**Assessment:** this connects the unit being trained to the unit being measured. The useful lesson is to make the target and its evidence visible. It does not mean TypeForge needs every chart.

### Guest value and practical customization

**Documented and observed:** guest history stays locally available; accounts add cross-device access. Display controls, input assists, keyboard geometry and layout emulation support different learning preferences. [Account][k-account-live], [keyboard settings][k-keyboard-settings], [text settings][k-text-settings]

**Observed and documented input choices:** stop on an error, forgive certain errors, or use Space to skip the rest of a word. These can protect the learning flow, but change what a successful exercise means. Record the relevant settings when comparing results. [Text settings][k-text-settings]

**Assessment:** users can try the product seriously before signing in. Settings also acknowledge that learning a layout and testing fluent speed are different tasks. TypeForge should retain useful guest behavior as cloud features arrive.

## Where keybr is weaker or creates trade-offs

| Finding | Evidence and boundary | Assessment for TypeForge |
| --- | --- | --- |
| The teaching surface can be dense | The practice screen combines lesson text, a keyboard, key states, metrics, streaks and a daily target. The initial guided tour spans many slides. [Live practice][k-live] | Helpful for a beginner needing orientation; potentially excessive for an experienced typist. Offer a short introduction with deeper help on demand. |
| Restricted letters constrain natural language | Dictionary selection must respect the available alphabet and focus letter. [Dictionary][k-dictionary] | This isolates a skill, but early passages have narrow vocabulary and little meaning. Mix focused work with a separate general assessment rather than treating constrained-lesson speed as universal ability. |
| Some onboarding descriptions lag current defaults | The inspected tutorial described most generated words as invented; the natural-word option was enabled and the first lesson used ordinary words. [Live tutorial][k-live], [natural-word setting][k-natural] | Keep onboarding, defaults and implementation aligned. Otherwise users can form the wrong mental model before they start. |
| “Confidence” sounds stronger than its definition | It is a ratio between a target interval and estimated actual interval. [Target calculation][k-target] | Label it as progress toward a speed target. It is neither statistical certainty nor a probability that a skill has been mastered. |
| Default progression uses historical best | The ordinary selector retains credit for previously reached thresholds; an optional recovery setting uses current performance. [Selector][k-guided], [recovery option][k-recover] | Prior achievement avoids frustrating relocking, but can conceal later deterioration. Make current evidence and historical best distinct. |
| Speed-based unlocking has limits | Per-key correct timing is smoothed; typo steps are excluded from its timing histogram. No separate accuracy or minimum-observation gate was found in the inspected selector/target code. [Key statistics][k-keystats], [histogram][k-histogram], [selector][k-guided] | Require adequate evidence for our recommendations and keep errors visible. Do not interpret fast correct instances as complete mastery. |
| Forecasts can appear more certain than they are | The learning-rate implementation fits a polynomial to recent samples and filters on in-sample fit. [Forecast][k-forecast] | Useful experimentation, but future predictive reliability must be tested separately. Do not dismiss its forecast as nonexistent, or treat it as externally validated. |
| Population comparisons can overgeneralize | After one restricted-alphabet lesson, the guest profile showed a percentile relative to other users. [Live profile][k-profile-live] | The comparison needs task and population context. A high percentile on one easy lesson is not a general typing qualification. |
| The daily target can feel large | The observed default was 30 minutes; the setting explains that it is a reminder, not a limit. [Daily-goal explanation][k-daily-goal] | Make a small session feel worthwhile and let users choose a goal. This review does not establish an optimal practice duration. |
| Narrow-screen presentation was weaker in this check | At 390 pixels wide, the practice document measured 728 pixels across, with an 8px body font. [Screenshot](screenshots/keybr-narrow.png) | Keep essential controls readable without page-level horizontal scrolling. This is one viewport observation, not a test of every device or mobile keyboard. |
| Accessibility needs more than visual options | There are useful font, caret, whitespace and sound controls. The capture textarea lacked an explicit accessible label in the inspected component and browser tree. [Text input][k-input], [text settings][k-text-settings] | Keep our real labelled input while improving its visual integration. Test screen readers and chart alternatives before making accessibility claims. |
| Account privacy controls need careful wording | Public-profile features exist; anonymization changes the displayed identity rather than hiding all statistics. [Account controls][k-account-source], [public data controller][k-public] | Keep TypeForge profiles private by default. Distinguish hiding identity, disabling sharing, deleting results and deleting an account. |
| Free use carries advertising trade-offs | Premium is advertised as removing ads and associated trackers through one lifetime payment. The UK session displayed £7.52; that is not a universal price or completed checkout quote. [Live account][k-account-live] | Avoid introducing ads into our practice loop. Treat privacy marketing as a claim, not proof that every tracker disappears. |

Keybr help illustrates progress using selected user histories. Those examples are useful demonstrations, but do not establish a representative success rate, a causal training effect or transfer to ordinary writing. [Official help][k-help]

## The measurement and prediction details that matter

### Scores are not directly interchangeable

| Product | Relevant definition | Consequence |
| --- | --- | --- |
| Monkeytype | WPM generally credits correctly typed words; timed-test implementation also handles a partial final word. Accuracy retains key-input accounting. [About][m-about], [statistics][m-stats] | A wrong letter can affect more WPM credit than TypeForge's positional rule. Corpus, mode and correction settings also matter. |
| keybr | Speed uses completed positions per elapsed time, converted to five-character words; positions with errors still count toward speed. Accuracy penalizes each erroneous position once. Our repeated-error check matched that behavior. [Speed calculation][k-stats], [units][k-speed-unit], [error accounting][k-text-input] | Both speed credit and accuracy differ from TypeForge's rules. Repeated wrong presses at one position do not each lower accuracy again, although time spent on them affects speed. |
| TypeForge now | WPM counts retained positional matches; accuracy counts every inserted-character attempt. Deleted mistakes stay in the denominator. [Engine](../../typing-app/client/src/engine.ts) | Explain the definition, preserve versions and compare only matching assessment settings. Do not imply score compatibility with either site. |

### Both products already adapt

Monkeytype's weakspot implementation combines smoothed character timings with a fixed error penalty and searches sampled word candidates. The missed/slow-word workflow is a separate useful mechanism. [Weakspot][m-weakspot], [practice][m-practice]

Keybr's character timing is averaged per result and smoothed across results with an exponential moving average using α = 0.1. Its confidence calculation is a speed ratio against a default 35 WPM target. These are understandable rules, not a demonstrated optimizer of future learning. [Key statistics][k-keystats], [target][k-target], [defaults][k-settings], [speed units][k-speed-unit]

Keybr also has a fitted forecast: up to 30 recent per-key samples, polynomial fits of degree one through three, an in-sample R² threshold of 0.5, and a search for target crossing within 50 future lessons. We did not locate a held-out forecasting benchmark in the inspected documentation. [Forecast source][k-forecast]

**Assessment:** TypeForge's proposed contextual pair model is a distinct experiment, but it still needs to beat simple baselines prospectively. Even success at predicting correct-copy timing would not prove that practising the recommended pair improves transferable typing skill.

### Privacy and reproducibility have different costs

Monkeytype's policy describes account/test/settings data, analytics, crash reporting and optional advertising. It says custom text remains in browser storage. Keybr distinguishes local guest data from account synchronization; its result schema stores aggregate typing statistics rather than the complete displayed passage and every event. [Monkeytype privacy][m-privacy], [keybr account][k-account-live], [keybr result schema][k-result]

Keybr's privacy policy also describes collection of browser/request metadata and IP addresses, plus disclosures to service providers. Local guest typing history does not mean that visiting the site creates no server or third-party data. [Official policy][k-privacy]

**Assessment:** retaining the actual assessment passage, corpus version and relevant summary counts is valuable for TypeForge's reproducibility. Indefinite raw-key logging is unnecessary for ordinary progress. Keep research capture explicit and separate from normal history.

The repositories identify Monkeytype as GPL-3.0 and keybr as AGPL-3.0. This review uses them as behavioral and algorithmic references; no source was copied into TypeForge. [Monkeytype license][m-license], [keybr repository][k-repo]

## What this means for TypeForge before further implementation

These proposals are ordered by their likely usefulness to the first release. They require product decisions and appropriate checks before changing the existing implementation.

| Priority | Proposal | Reason and acceptance evidence |
| --- | --- | --- |
| First | Improve the typing surface before adding analytical complexity | Prototype a more visually integrated prompt/input treatment while retaining native editing and a labelled field. Compare eye movement, correction comfort, focus behavior and narrow layout with the current screen. No custom editor unless the native approach fails. |
| First | Review the sentence-by-sentence Enter interaction | Both reviewed practice flows continue across words. Our explicit submission creates clean sentence boundaries but adds an interruption. Test whether it helps or frustrates everyday typists before changing capture/training contracts. |
| First | Put one next action ahead of the dashboard | Results should answer what happened, what to do next and why. Show the target, supporting count, uncertainty/insufficient-data state and an easy general-practice alternative. Avoid introducing every competitor chart. |
| First | Make comparison rules visible | Label assessment and practice separately; retain mode/corpus/metric versions. Explain that our WPM and accuracy may differ from other sites. Never turn a drill score or repeated passage into an unsupported improvement claim. |
| Next | Keep a simple observed-data practice option alongside the ML experiment | Missed/slow-word and key-based heuristics are credible competitors and useful baselines. A deterministic fallback keeps the product usable while the trained candidate is evaluated. Do not mislabel that fallback as a trained model. |
| Next | Check timing coverage for learners who make errors | Our current rule excludes timing from an entire sentence containing a correction, while keybr can retain valid timings elsewhere in an imperfect lesson. Measure exclusion by speed/error rate. Do not relax eligibility silently: change both pipelines and metric versions if evidence warrants it. |
| Next | Hide model mechanics during typing and expose explanations afterward | Learning-rate jargon, confidence ratios and dense graphs can demand unnecessary interpretation. Use plain language and keep the full model report available separately. |
| Next | Preserve guest usefulness and privacy as accounts arrive | Local history and export already work. Cloud sync should add convenience, not remove guest functionality or turn profiles public by default. |
| Next | Offer a few high-value preferences | Consider text size, readable contrast, reduced motion and showing/hiding live metrics first. Validate keyboard navigation. Avoid copying entire theme, sound and Funbox catalogs. |
| Later | Broaden realistic content deliberately | Capitalization, punctuation and longer prose improve task coverage, but require updated scoring, timing support and benchmark definitions. Code, multilingual content and alternative layouts should follow demonstrated demand. |
| Later | Add habit and community features only for a concrete need | A small optional goal may help regular practice. Streaks, rankings, social features and monetization introduce separate product work and do not establish better learning. |

The current implementation is a useful measurement foundation, but its separate input, fixed duration, sparse timing coverage and unguided general practice are real limitations. The proposed trained model does not remove those usability problems. Equally, the competitors' broader feature lists do not justify expanding TypeForge's first release to match them.

## Evidence screenshots

These are dated interface observations, not assets to reuse in TypeForge. The test scores were generated by automated inspection. Default/selected settings and promotional content can change.

| Screenshot | What to inspect |
| --- | --- |
| [Monkeytype test](screenshots/monkeytype-test.png) | Integrated prompt, restrained controls, shortcut hints and the observed merchandise banner |
| [Monkeytype results](screenshots/monkeytype-results.png) | Primary metric hierarchy, secondary statistics and compact next-action controls |
| [keybr practice](screenshots/keybr-practice.png) | Focus key, alphabet progression, keyboard aid and unlock notification |
| [keybr settings](screenshots/keybr-settings.png) | Target-speed explanation, recovery option and enabled natural-word preference |
| [keybr narrow layout](screenshots/keybr-narrow.png) | Overflow/readability at the inspected 390px viewport |

## Remaining questions

- Can first-time everyday typists identify the next useful exercise without reading a tutorial or chart? Test the proposed TypeForge flow with users.
- Does our whole-sentence filter leave enough evidence for less accurate typists? The data audit must answer this before model claims.
- Does contextual prediction outperform smoothed personal timing on independent TypeForge runs? Keep the planned locked evaluation.
- Does adaptive practice improve fresh-passage performance more than equal-duration general practice, with a later retention check? Neither a prediction benchmark nor these site walkthroughs answers that.
- Do the important flows work with a screen reader, keyboard-only navigation, zoom and reduced motion? This review identifies concerns rather than certifying accessibility.
- How reliably do signed-in history, export and deletion work over multiple devices? Public descriptions/source support the feature inventory; account operations remain untested.

[m-live]: https://monkeytype.com/
[m-readme]: https://github.com/monkeytypegame/monkeytype/blob/master/README.md
[m-about]: https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/ts/components/pages/AboutPage.tsx
[m-settings]: https://monkeytype.com/settings
[m-metadata]: https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/ts/config/metadata.tsx
[m-stats]: https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/ts/test/events/stats.ts
[m-renderer]: https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/ts/test/result.ts
[m-funbox]: https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/ts/test/funbox/funbox-functions.ts
[m-practice]: https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/ts/test/practise-words.ts
[m-weakspot]: https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/ts/test/weak-spot.ts
[m-account]: https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/ts/components/pages/account/AccountPage.tsx
[m-filters]: https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/ts/components/pages/account/Filters.tsx
[m-privacy]: https://monkeytype.com/privacy-policy
[m-support]: https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/ts/components/modals/SupportModal.tsx
[m-license]: https://github.com/monkeytypegame/monkeytype/blob/master/LICENSE
[k-live]: https://www.keybr.com/
[k-repo]: https://github.com/aradzie/keybr.com
[k-guided]: https://github.com/aradzie/keybr.com/blob/05a37bc5265f65ff538c59c613db29442f345d51/packages/keybr-lesson/lib/guided.ts
[k-target]: https://github.com/aradzie/keybr.com/blob/05a37bc5265f65ff538c59c613db29442f345d51/packages/keybr-lesson/lib/target.ts
[k-settings]: https://github.com/aradzie/keybr.com/blob/master/packages/keybr-lesson/lib/settings.ts
[k-daily-goal]: https://github.com/aradzie/keybr.com/blob/05a37bc5265f65ff538c59c613db29442f345d51/packages/page-practice/lib/settings/lesson/DailyGoalSettings.tsx
[k-stats]: https://github.com/aradzie/keybr.com/blob/05a37bc5265f65ff538c59c613db29442f345d51/packages/keybr-textinput/lib/stats.ts
[k-speed-unit]: https://github.com/aradzie/keybr.com/blob/05a37bc5265f65ff538c59c613db29442f345d51/packages/keybr-result/lib/speedunit.ts
[k-text-input]: https://github.com/aradzie/keybr.com/blob/05a37bc5265f65ff538c59c613db29442f345d51/packages/keybr-textinput/lib/textinput.ts
[k-recover]: https://github.com/aradzie/keybr.com/blob/master/packages/page-practice/lib/settings/lesson/RecoverKeysProp.tsx
[k-natural]: https://github.com/aradzie/keybr.com/blob/master/packages/page-practice/lib/settings/lesson/NaturalWordsProp.tsx
[k-dictionary]: https://github.com/aradzie/keybr.com/blob/master/packages/keybr-lesson/lib/dictionary.ts
[k-modes]: https://github.com/aradzie/keybr.com/blob/master/packages/keybr-lesson/lib/lessontype.ts
[k-layouts]: https://github.com/aradzie/keybr.com/blob/master/packages/keybr-keyboard/lib/layout.ts
[k-keyboard-settings]: https://github.com/aradzie/keybr.com/blob/master/packages/keybr-keyboard/lib/settings.ts
[k-profile]: https://github.com/aradzie/keybr.com/blob/master/packages/page-profile/lib/ProfilePage.tsx
[k-profile-live]: https://www.keybr.com/profile
[k-account-live]: https://www.keybr.com/account
[k-account-source]: https://github.com/aradzie/keybr.com/blob/master/packages/page-account/lib/AccountSection.tsx
[k-keystats]: https://github.com/aradzie/keybr.com/blob/master/packages/keybr-result/lib/keystats.ts
[k-histogram]: https://github.com/aradzie/keybr.com/blob/master/packages/keybr-textinput/lib/histogram.ts
[k-forecast]: https://github.com/aradzie/keybr.com/blob/master/packages/keybr-lesson/lib/learningrate.ts
[k-input]: https://github.com/aradzie/keybr.com/blob/master/packages/keybr-textinput-events/lib/TextEvents.tsx
[k-text-settings]: https://github.com/aradzie/keybr.com/blob/master/packages/keybr-textinput/lib/settings.ts
[k-result]: https://github.com/aradzie/keybr.com/blob/master/packages/keybr-result/lib/result.ts
[k-public]: https://github.com/aradzie/keybr.com/blob/master/packages/server/lib/app/sync/controller.ts
[k-privacy]: https://github.com/aradzie/keybr.com/blob/05a37bc5265f65ff538c59c613db29442f345d51/packages/page-static/lib/privacy-policy.md
[k-help]: https://github.com/aradzie/keybr.com/blob/master/packages/page-help/lib/HelpPage.tsx
