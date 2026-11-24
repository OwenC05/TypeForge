# TypeForge English sentence banks v2

600 uniformly sampled assessment sentences and 292 targeted practice sentences cover all 100 candidate pairs. Each pair has 33–106 dense passages and three disjoint plans. The two files total 92,032 bytes, or 22,087 bytes (21.6 KiB) when served separately with gzip level 9.

## Source and reproduction

Tatoeba publishes an English subset dedicated to CC0 1.0 Universal alongside its default CC BY 2.0 FR data. CC0 permits editing and public redistribution, including commercial use. The attribution file contains the legal text and explains the original sentence IDs. [Tatoeba exports](https://tatoeba.org/en/downloads) · [CC0 legal code](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en) · [Bank attribution](../../typing-app/client/src/generated/CORPUS-ATTRIBUTION.md)

Simple English Wikipedia generally requires attribution and share-alike for text adaptations. Project Gutenberg’s public-domain determinations cover the US and international reuse calls for checking each work. Tatoeba’s sentence-level CC0 export provides a single source of short contemporary English sentences. [Wikimedia reuse terms, §7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use/en#7._Licensing_of_Content) · [Gutenberg permissions](https://www.gutenberg.org/policy/permission.html)

Snapshot published 2026-11-21 06:31:37 UTC, downloaded 2026-11-24 15:33:41 UTC. The compressed export is 1,288,689 bytes with SHA-256 `c2e2edd063a31cbbc8e416a4858225e934bbb0afff485031821e59f230ccf1ca`. The weekly URL rotates. The builder reads `ml/corpus/.cache/eng_sentences_CC0.tsv.bz2`. A second hash-verified copy on the build host survives worktree cleanup at `%LOCALAPPDATA%/TypeForge/corpus/<sha256>/eng_sentences_CC0.tsv.bz2`. [Download URL](https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences_CC0.tsv.bz2)

From the repository root in WSL, run `python3.14 ml/corpus/build_banks.py`. Python 3.14.4 uses only the standard library and the cached source. It pins the v1 `corpus.ts` and `coach-config.json` at base `6ce7e02999c668454459da42ad5d832b5f13f9bf`, and caches LF-normalised copies for rebuilding after B7.

## Filtering and lengths

Each row records its first failing filter. A single terminal `.`, `?` or `!` is a sentence boundary. All interior characters and spaces must already fit. The vocabulary ranks ASCII tokens across the 41,515 English source rows, breaking frequency ties alphabetically.

| Stage | Removed | Remaining |
| --- | ---: | ---: |
| English CC0 rows | — | 41,515 |
| ASCII words separated by single spaces, then lowercase | 22,716 | 18,799 |
| 30–70 characters including spaces | 8,575 | 10,224 |
| Reject any capitalised non-initial token, including the pronoun I | 2,169 | 8,055 |
| Topic and tone blocklist | 970 | 7,085 |
| At least 95% of tokens in the 20,000 most frequent | 689 | 6,396 |
| Reject spellings outside house style, such as `color` and `organize` | 127 | 6,269 |
| Source IDs reviewed for everyday tone, clarity and sentence-initial names | 4,924 | 1,345 |
| Exact v1 overlap / exact v2 duplicates | 0 / 0 | 1,345 |
| Near duplicates, including either v1 bank | 11 | 1,334 |

The fixed [editorial selection](everyday-ids.txt) admits 1,348 original IDs on wording alone. Three already fail earlier filters. It excludes names, unsuitable material and runs of repeated motivational or political prose that word matching misses. Lower source ID takes precedence for one-word edits, reordered words, shared one-word deletions or character-trigram Dice similarity ≥0.85.

| Bank | Sentences | Min | P10 | Median | P90 | Max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Practice v1 | 80 | 36 | 38 | 43 | 47 | 51 |
| Assessment v1 | 40 | 37 | 41 | 44.5 | 50 | 53 |
| Filtered pool | 1,334 | 30 | 31 | 36 | 52 | 69 |
| Assessment v2 | 600 | 30 | 31 | 37 | 53 | 68 |
| Practice v2 | 292 | 30 | 34 | 42 | 57 | 68 |

## Pair coverage

Assessment draws 600 IDs by `Random(20261124).sample(sorted(pool), 600)` before any pair ranking. The [frequency table](pair_frequencies.json) uses the entire filtered pool. It records 676 pairs, including zeroes, in 51,889 characters with 33,003 overlapping within-word occurrences. For expected time lost per 1,000 characters, use `1000 * per_character`. This estimates the edited English register used here.

The top 100 pairs account for 25,453 occurrences (77.12%). Reaching 90% would take 161 pairs. For each candidate, **cutoff** is twice its assessment occurrences per 1,000 typed characters. **Dense** counts distinct practice sentences meeting that cutoff. **Weakest** is the smallest prefix density ratio to uniform General practice across all three witnesses. The build uses exact integer comparisons. Display values are rounded.

All 300 witnesses use dense sentences. The first pair ends at characters 2–20, three distinct target words finish by character 240, and at least four passages finish by character 480. Plans contain 480–539 characters. All 145,005 prefixes from character 20 to the final character passed 1.25× General, with a minimum of 1.2686×. Spaces within prompts count and there is no separator between prompts. Every candidate met both targets.

The build reuses passages across different targets and forbids reuse across a single target’s three plans. It tries single-passage deletions until this deterministic planner can remove no more. The global minimum over every possible ordering is unknown. Ordered witness IDs are regenerated at `ml/corpus/.cache/plan-witnesses.json`.

| Pair | Cutoff / 1,000 | Dense | Weakest × General |
| --- | ---: | ---: | ---: |
| th | 56.64 | 37 | 1.539 |
| he | 53.51 | 40 | 1.556 |
| in | 28.92 | 47 | 1.325 |
| ou | 25.86 | 67 | 1.798 |
| re | 28.41 | 37 | 2.058 |
| er | 25.61 | 60 | 1.369 |
| an | 19.93 | 79 | 1.345 |
| to | 19.16 | 68 | 1.948 |
| at | 16.45 | 96 | 1.294 |
| on | 15.60 | 106 | 1.317 |
| ng | 16.28 | 87 | 1.343 |
| ar | 17.38 | 80 | 1.269 |
| or | 15.52 | 76 | 1.818 |
| ha | 14.92 | 84 | 1.377 |
| ed | 15.52 | 74 | 2.109 |
| yo | 14.08 | 66 | 1.873 |
| st | 14.50 | 89 | 1.611 |
| es | 13.40 | 80 | 2.222 |
| te | 13.99 | 76 | 1.304 |
| is | 12.55 | 77 | 1.530 |
| ve | 13.06 | 67 | 1.643 |
| en | 13.06 | 78 | 1.304 |
| ea | 12.04 | 64 | 1.956 |
| nd | 10.85 | 78 | 1.500 |
| ne | 11.28 | 50 | 1.825 |
| hi | 10.18 | 62 | 1.727 |
| le | 10.68 | 63 | 1.895 |
| it | 9.41 | 73 | 1.756 |
| nt | 9.84 | 60 | 1.615 |
| me | 9.41 | 51 | 2.360 |
| ti | 9.92 | 68 | 1.672 |
| al | 10.18 | 51 | 2.143 |
| se | 9.75 | 50 | 2.124 |
| as | 10.18 | 58 | 2.109 |
| ca | 9.84 | 48 | 2.971 |
| ro | 8.99 | 58 | 3.228 |
| ee | 9.67 | 39 | 3.386 |
| ll | 8.90 | 62 | 2.190 |
| co | 8.14 | 55 | 1.767 |
| of | 8.82 | 46 | 3.164 |
| be | 8.06 | 57 | 2.109 |
| wa | 8.31 | 47 | 2.487 |
| ho | 8.23 | 54 | 2.062 |
| ta | 8.48 | 52 | 2.139 |
| et | 8.99 | 42 | 3.595 |
| la | 7.04 | 56 | 1.856 |
| fo | 6.78 | 47 | 2.102 |
| ur | 6.87 | 43 | 3.825 |
| de | 6.95 | 45 | 2.288 |
| ke | 8.06 | 36 | 5.085 |
| om | 6.61 | 53 | 1.972 |
| li | 7.46 | 49 | 3.015 |
| ri | 6.78 | 43 | 2.443 |
| ow | 6.36 | 47 | 2.564 |
| ch | 6.70 | 41 | 3.216 |
| do | 6.19 | 34 | 4.817 |
| ce | 7.21 | 38 | 3.495 |
| sh | 7.12 | 40 | 2.976 |
| we | 6.36 | 39 | 2.483 |
| el | 6.78 | 42 | 3.451 |
| ac | 6.87 | 42 | 2.855 |
| un | 5.85 | 37 | 3.082 |
| ey | 5.60 | 40 | 3.551 |
| lo | 6.11 | 44 | 2.391 |
| pe | 5.77 | 47 | 2.539 |
| ma | 5.51 | 41 | 2.554 |
| ra | 5.43 | 44 | 2.753 |
| oo | 5.51 | 36 | 3.236 |
| ic | 5.43 | 40 | 3.239 |
| us | 5.94 | 34 | 3.736 |
| di | 5.60 | 37 | 3.093 |
| wh | 5.26 | 35 | 3.422 |
| wi | 4.58 | 48 | 2.912 |
| ld | 5.34 | 36 | 3.789 |
| ns | 5.60 | 36 | 3.390 |
| so | 4.49 | 42 | 2.612 |
| ut | 5.09 | 34 | 5.187 |
| ul | 4.83 | 39 | 3.599 |
| pl | 4.92 | 33 | 3.240 |
| ad | 5.00 | 33 | 4.187 |
| il | 5.34 | 34 | 3.559 |
| si | 4.49 | 43 | 2.636 |
| wo | 4.66 | 34 | 3.967 |
| ot | 4.07 | 39 | 3.955 |
| ec | 4.32 | 35 | 3.832 |
| pa | 4.41 | 35 | 3.755 |
| ay | 3.56 | 36 | 4.159 |
| gh | 4.66 | 35 | 2.910 |
| ai | 4.66 | 35 | 3.330 |
| rs | 4.32 | 34 | 4.045 |
| ge | 4.58 | 33 | 2.964 |
| ts | 3.48 | 44 | 2.110 |
| av | 3.99 | 33 | 4.515 |
| no | 3.99 | 34 | 4.288 |
| ig | 3.48 | 36 | 3.011 |
| rt | 4.24 | 36 | 4.468 |
| ie | 4.16 | 36 | 3.645 |
| io | 4.32 | 34 | 4.237 |
| fe | 3.14 | 34 | 4.520 |
| ly | 4.24 | 35 | 3.206 |

## Random tone samples

Twenty draws per bank, without replacement, from files sorted by source ID. Assessment sample seed 20261125. Practice sample seed 20261126.

| Assessment | Practice |
| --- | --- |
| i am happy to receive corrections | he always asks insightful questions |
| we could always make a day trip there | he watches the stars with quiet wonder |
| the moonlight lit the path ahead | why do they turn the lights on in the cinema during the credits |
| they collaborate with musicians around the world | is there anything you wished would come back into fashion |
| the midnight showing is sold out | you never stop learning about dinosaurs |
| i missed the opportunity to get to know her better | i think the second paragraph should be the opening one |
| she heard the rattle of the snake | it would cost more to repair this than to get a new one |
| there are billions of galaxies scattered throughout the universe | what can you infer from these observations |
| can you start from the beginning | this enormous longhorn beetle is found around mango and fig trees |
| no sooner had they left than the storm began | the mountain cabin had a stunning view of the valley below |
| did you take notes during class | tourists can go on a guided tour inside the windmill |
| did you have any questions about the homework | he found the right shoe for his foot |
| please could you write your forename in the space provided | she dreams of starting her own record label |
| did you say thirty or thirteen | this picture could use some retouching |
| my partner grills the best mushrooms | she writes music reviews for a magazine |
| all functions considered in this chapter are real | she creates digital portraits for clients |
| butterflies are fluttering all over the place | they found a beach with soft white sand and clear blue water |
| do you listen to music while you work | the beach was so quiet they could hear the waves clearly |
| i think the batteries need to be replaced | gravity is what keeps planets in orbit around stars |
| would you work holidays and weekends | explorers may one day travel beyond our solar system to other stars |

## Verification and handoff

Two offline builds used independent WSL Python processes with `PYTHONHASHSEED=17` and `91`. The second ran from `/tmp`. The bank files, frequencies and plan witnesses matched the first run byte for byte.

| Output | Gzip bytes | SHA-256, first run | SHA-256, second run |
| --- | ---: | --- | --- |
| Assessment | 14,118 | `9cf62b31ce6e106b6f3bee3dd5508d95e9a3d938401a3f3a84814905efd25859` | `9cf62b31ce6e106b6f3bee3dd5508d95e9a3d938401a3f3a84814905efd25859` |
| Practice | 7,969 | `007ff291df1c521cde82473ed5af59e658bb826894f1662ac6533f8aeea4b7d0` | `007ff291df1c521cde82473ed5af59e658bb826894f1662ac6533f8aeea4b7d0` |

`python3.14 -m unittest discover -s ml/corpus -v` passed 6/6 offline audits. The client’s `pairOccurrences` also independently verified the 300 ordered plans against its current exposure configuration. The existing `/mnt/c/Users/Owenc/Documents/GitHub/TypeForge/.venv/bin/python -m unittest discover -s ml/tests -v` suite passed 21/21. From `typing-app/client`, `npm ci --no-audit --no-fund` and `npm run check` passed all 235 Node tests, TypeScript and the Vite build.

Branch `OwenC05/tf-corpus-v2`. Bank implementation and checks `0196a7c678114ec370a23e1e9b7f2ba8b5e3df20`. Resolve the committed report revision with `git log -1 --format=%H -- ml/corpus/REPORT.md`. The local dispatch receipt at `.cache/delivery.txt` records the literal final SHA.

B7 owns browser integration. The coordinator can review the tone sample before enabling v2. These checks measure planned typing opportunities. Typing benefit and delivered exposure require pilot data.
