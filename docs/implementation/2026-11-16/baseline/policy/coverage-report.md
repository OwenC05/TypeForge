# Bounded corpus and all-prefix certificate probe

Run: `node docs/implementation/2026-11-16/baseline/policy/coverage-probe.mjs` (Node v24.21.0); assertions pass. JSON is 76291 bytes, with hashes, compact run witnesses and twelve fixed plan examples. Only the three assigned artifacts are changed.

## Definitions and claim limits

- Canonical General and planned-prefix characters include internal spaces but exclude synthetic passage separators; lowercase pairs never cross passage boundaries. Legacy joined-bank denominator is reported only for comparison.
- Certificate is exact 4*opportunities*GeneralCharacters >= 5*n*GeneralOccurrences at every integer n20..planLength, with all independent first-target/context/repeat gates. Equality passes; zero corpus support fails.
- Checkpoint density passes are counterexamples only, never an all-prefix certificate. The former 149 checkpoint-pass count is superseded and is not final certificate coverage; no all-pair certificate search is performed.
- Each synthetic scenario is ten 30-second runs: WPM*5/2 insertion slots/run including terminal submission Space. This is a normalized ideal budget, not actual engine-scored WPM or a human-yield estimate.
- Fresh seeded queue per run versus repeated-order stress; unfinished prefixes discarded on restart. Complete counts assume correct unedited compatible sentences and intervals <=5000ms. Errors can reduce eligible timing support to zero.
- 8/12/20 plus 3-prompt/3-word/3-run sensitivity is illustrative only. Draft final count/context ceiling uses latest unique prompt text, 20 target/80 other intervals, 4 target-bearing runs, 4 target-bearing prompts and 3 words; it is not a passing timing recommendation.
- No timing effect/stability is generated. Uniform synthetic timing has zero log contrast and must abstain regardless of support/certificate. No learning benefit, confidence or delivered-dose claim follows.
- Fixed ordering for whole-prompt plans reaching minimum240/480 characters only; every position through the actual full final passage is checked. No adaptive sampler, optimization, content edits or production changes. Full words/passages count after complete traversal.
- Planned certificates do not establish actual exposure: before first target completion there may be zero opportunities, n<20 is too short, and n<240 has partial context. Unsupported examples correctly fall back to General/manual.

## Corpus and ten-run source budgets

Assessment has 40 unique texts, 1803 characters, 1490 letters, 353 word tokens/218 word types; 135 tokens repeat beyond first use and 36 word types occur in multiple prompts. Text lengths are 37-53, excluding submission Space. Practice has 80 unique texts and 3427 canonical characters; legacy joined-bank calculation adds 79 synthetic spaces (3506 characters). JSON retains repeated-word counts, not redundant per-pair schedules.

Prior learning/ML counts reproduce: 219 assessment pairs, 184 legacy practice-supported pairs, 170 assessment pairs with that support, and 41 pairs able to reach eight opportunities in some <=10-distinct-assessment-prompt selection. The 18 legacy-supported pairs with <3 words cannot pass the new diversity gate. No support count establishes a nonzero timing contrast.

Schedule | WPM | Slots/run | Complete | Distinct complete | Repeated complete | Partial | Illustrative >=8 +3/3/3 | Final count/context ceiling
--- | --- | --- | --- | --- | --- | --- | --- | ---
seeded-restarts | 10 | 25 | 0 | 0 | 0 | 10 | 0 | 0
seeded-restarts | 30 | 75 | 10 | 10 | 0 | 10 | 2 | 0
seeded-restarts | 60 | 150 | 30 | 20 | 10 | 10 | 30 | 1
repeated-order-stress | 10 | 25 | 0 | 0 | 0 | 10 | 0 | 0
repeated-order-stress | 30 | 75 | 10 | 1 | 9 | 10 | 0 | 0
repeated-order-stress | 60 | 150 | 30 | 3 | 27 | 10 | 2 | 0

Ten runs are five active minutes plus setup/breaks. At artificial10 WPM, 25 slots cannot complete any assessment sentence, so participation may complete while clean-timing evidence remains empty. Final count/context column deduplicates latest eligible prompt text and applies only the draft 20/80/4-runs/4-prompts/3-words support requirements; effect, halves/stability and exposure remain unproved. The 3/3/3 column and 8/12/20 sensitivities in JSON are earlier illustrative gates.

## Bounded fixed-plan results

Pair | Minimum / actual length | Bank prompts/words | First target | Positions checked | First density failure | Worst density ratio | Words by240 | Complete passages by480 | All gates pass
--- | --- | --- | --- | --- | --- | --- | --- | --- | ---
th | 240/267 | 71/11 | 2 | 248 | 26 | 0.992 | 3 | n/a | false
th | 480/493 | 71/11 | 2 | 474 | 26 | 0.992 | 3 | 10 | false
he | 240/268 | 74/16 | 3 | 249 | 25 | 0.927 | 4 | n/a | false
he | 480/491 | 74/16 | 3 | 472 | 25 | 0.927 | 4 | 10 | false
ag | 240/252 | 3/3 | 24 | 233 | 20 | 0 | 3 | n/a | false
ag | 480/504 | 3/3 | 24 | 485 | 20 | 0 | 3 | 3 | false
au | 240/245 | 1/1 | 38 | 226 | 20 | 0 | 1 | n/a | false
au | 480/490 | 1/1 | 38 | 471 | 20 | 0 | 1 | 1 | false
zz | 240/0 | 0/0 | none | 0 | none | none | 0 | n/a | false
zz | 480/0 | 0/0 | none | 0 | none | none | 0 | n/a | false
br | 240/256 | 11/9 | 4 | 237 | none | 6.109 | 6 | n/a | true
br | 480/522 | 11/9 | 4 | 503 | none | 6.109 | 6 | 11 | true

Checkpoint counterexamples: th/267 first fails at n=26; th/493 first fails at n=26; he/268 first fails at n=25; he/491 first fails at n=25. Passing selected 20/40/80/120/240(/480) densities therefore cannot guarantee every integer prefix. The previous149 checkpoint-pass statistic was not final certificate coverage and is superseded. br provides a bounded feasible example under this one static ordering; failure of an arbitrary ordering alone does not prove global infeasibility. ag is impossible under the stated whole-prompt rules because its earliest target completes at24 and it has only3 target-bearing prompts (<4); au has only1 prompt/word and repeated cycling violates adjacency; zz has no source support. General/manual fallback is a correct result.

### th

General target opportunities=108; /100 canonical characters=3.151, /100 letters=3.819, /100 legacy joined characters=3.08. Target-only bank /100 chars=3.547, /100 letters=4.293. Available whole words: another, bathroom, beneath, path, the, their, them, there, this, through, with. Failed checks: everyIntegerPrefixDensity.

n | Opportunities | /100 chars | /100 letters | Ratio to canonical General | Density passes | Fully traversed word types
--- | --- | --- | --- | --- | --- | ---
20 | 1 | 5 | 5.882 | 1.587 | true | 1
40 | 2 | 5 | 5.882 | 1.587 | true | 1
80 | 4 | 5 | 5.97 | 1.587 | true | 1
120 | 5 | 4.167 | 5 | 1.322 | true | 1
240 | 11 | 4.583 | 5.528 | 1.454 | true | 3
480 | 20 | 4.167 | 5.013 | 1.322 | true | 5

### he

General target opportunities=112; /100 canonical characters=3.268, /100 letters=3.96, /100 legacy joined characters=3.195. Target-only bank /100 chars=3.511, /100 letters=4.247. Available whole words: another, check, helps, her, herbs, kitchen, matches, sheets, shelf, shelter, the, their, them, there, watched, when. Failed checks: everyIntegerPrefixDensity.

n | Opportunities | /100 chars | /100 letters | Ratio to canonical General | Density passes | Fully traversed word types
--- | --- | --- | --- | --- | --- | ---
20 | 1 | 5 | 5.882 | 1.53 | true | 1
40 | 2 | 5 | 5.882 | 1.53 | true | 1
80 | 5 | 6.25 | 7.463 | 1.912 | true | 2
120 | 6 | 5 | 6 | 1.53 | true | 2
240 | 13 | 5.417 | 6.5 | 1.657 | true | 4
480 | 21 | 4.375 | 5.25 | 1.339 | true | 5

### ag

General target opportunities=3; /100 canonical characters=0.088, /100 letters=0.106, /100 legacy joined characters=0.086. Target-only bank /100 chars=2.381, /100 letters=2.885. Available whole words: again, bag, village. Failed checks: fourBankPassages, firstTargetBy20, everyIntegerPrefixDensity, fourCompletePassagesBy480.

n | Opportunities | /100 chars | /100 letters | Ratio to canonical General | Density passes | Fully traversed word types
--- | --- | --- | --- | --- | --- | ---
20 | 0 | 0 | 0 | 0 | false | 0
40 | 1 | 2.5 | 3.03 | 28.558 | true | 1
80 | 2 | 2.5 | 3.077 | 28.558 | true | 2
120 | 2 | 1.667 | 2.02 | 19.039 | true | 2
240 | 5 | 2.083 | 2.525 | 23.799 | true | 3
480 | 11 | 2.292 | 2.778 | 26.178 | true | 3

### au

General target opportunities=1; /100 canonical characters=0.029, /100 letters=0.035, /100 legacy joined characters=0.029. Target-only bank /100 chars=2.041, /100 letters=2.439. Available whole words: restaurant. Failed checks: fourBankPassages, threeBankWords, firstTargetBy20, everyIntegerPrefixDensity, threeWordsBy240, fourCompletePassagesBy480, noAdjacentRepeat.

n | Opportunities | /100 chars | /100 letters | Ratio to canonical General | Density passes | Fully traversed word types
--- | --- | --- | --- | --- | --- | ---
20 | 0 | 0 | 0 | 0 | false | 0
40 | 1 | 2.5 | 3.03 | 85.675 | true | 0
80 | 1 | 1.25 | 1.515 | 42.837 | true | 1
120 | 2 | 1.667 | 2 | 57.117 | true | 1
240 | 5 | 2.083 | 2.5 | 71.396 | true | 1
480 | 10 | 2.083 | 2.494 | 71.396 | true | 1

### zz

General target opportunities=0; /100 canonical characters=0, /100 letters=0, /100 legacy joined characters=0. Target-only bank /100 chars=0, /100 letters=0. Available whole words: none. Failed checks: planLongEnough, fourBankPassages, threeBankWords, firstTargetBy20, everyIntegerPrefixDensity, threeWordsBy240.

n | Opportunities | /100 chars | /100 letters | Ratio to canonical General | Density passes | Fully traversed word types
--- | --- | --- | --- | --- | --- | ---

### br

General target opportunities=11; /100 canonical characters=0.321, /100 letters=0.389, /100 legacy joined characters=0.314. Target-only bank /100 chars=2.301, /100 letters=2.764. Available whole words: bread, break, breakfast, breeze, bridge, bright, bring, brown, library. Failed checks: none.

n | Opportunities | /100 chars | /100 letters | Ratio to canonical General | Density passes | Fully traversed word types
--- | --- | --- | --- | --- | --- | ---
20 | 1 | 5 | 5.882 | 15.577 | true | 1
40 | 1 | 2.5 | 2.941 | 7.789 | true | 1
80 | 2 | 2.5 | 2.941 | 7.789 | true | 2
120 | 3 | 2.5 | 2.97 | 7.789 | true | 3
240 | 6 | 2.5 | 3 | 7.789 | true | 6
480 | 11 | 2.292 | 2.757 | 7.14 | true | 9

A plan certificate starts at20 characters and establishes planned density/context only. An actual partial run can end before any target; corrections or noncontiguous edits cannot be reconstructed as a traversed prefix from final text. Actual realized exposure needs the separately reviewed instrument. The existing [learning](../../../../reviews/2026-11-15/learning-evidence/source-probe.mjs) and [ML](../../../../reviews/2026-11-15/ml-evidence/probe.mjs) probes remain source-mechanism evidence; neither this calculation nor their opportunity counts demonstrates useful targeting or learning. No adaptive sampler, exhaustive optimizer, production change or human measurement was made.
