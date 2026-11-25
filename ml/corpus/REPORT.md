# TypeForge English sentence banks v2

Assessments draw from 600 sentences. Pair practice covers 100 pairs with 406 sentences, giving each pair 37–125 dense passages and three disjoint plans. The assessment and practice files total 99,850 bytes, or 23,064 bytes (22.5 KiB) when compressed separately with gzip level 9.

## Source and reproduction

Tatoeba publishes an English subset dedicated to CC0 1.0 Universal alongside its default CC BY 2.0 FR data. CC0 permits editing and public redistribution, including commercial use. The attribution file contains the legal text and explains the original sentence IDs. [Tatoeba exports](https://tatoeba.org/en/downloads) · [CC0 legal code](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en) · [Bank attribution](../../typing-app/client/src/generated/CORPUS-ATTRIBUTION.md)

Simple English Wikipedia generally requires attribution and share-alike for text adaptations. Project Gutenberg’s public-domain determinations cover the US and international reuse calls for checking each work. Tatoeba’s sentence-level CC0 export provides a single source of short contemporary English sentences. [Wikimedia reuse terms, §7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use/en#7._Licensing_of_Content) · [Gutenberg permissions](https://www.gutenberg.org/policy/permission.html)

Snapshot published 2026-11-21 06:31:37 UTC, downloaded 2026-11-24 15:33:41 UTC. The compressed export is 1,288,689 bytes with SHA-256 `c2e2edd063a31cbbc8e416a4858225e934bbb0afff485031821e59f230ccf1ca`. The weekly URL rotates. The builder reads `ml/corpus/.cache/eng_sentences_CC0.tsv.bz2`. A second hash-verified copy on the build host survives worktree cleanup at `%LOCALAPPDATA%/TypeForge/corpus/<sha256>/eng_sentences_CC0.tsv.bz2`. [Download URL](https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences_CC0.tsv.bz2)

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
| Assessment v2 | 600 | 30 | 31 | 35 | 43 | 49 |
| Practice v2 | 406 | 30 | 32 | 37 | 46 | 51 |

## Pair coverage

The 49-character display cap leaves 1,170 of the 1,334 filtered sentences. Assessment samples 600 uniformly without replacement from their sorted source IDs using Python’s `Random(20261124)`, before pair selection. The frequency table still uses the full pool of 51,889 characters and 33,003 overlapping within-word occurrences across 676 pairs. Its top 100 pairs cover 25,453 occurrences (77.12%). Reaching 90% takes 161 pairs. Multiply a pair’s per-character rate by 1,000 for its expected occurrences per 1,000 typed characters. [Frequency table](pair_frequencies.json)

Three disjoint plans need at least 1,440 characters per target. After the assessment draw, all remaining sentences up to 49 characters containing `ec` total 1,415 characters. For `ie` they total 1,430. Each gets one additional sentence, the shortest available for that pair. The builder and the app restrict it to that drill.

| Pair | Source ID | Characters | Sentence |
| --- | --- | ---: | --- |
| ec | `tatoeba-9935723` | 51 | some birds migrate to roost during specific seasons |
| ie | `tatoeba-12764794` | 50 | they found a quiet spot to have lunch on the beach |

The cutoff is twice the assessment rate per 1,000 typed characters. Dense counts distinct eligible practice sentences meeting the cutoff. The last column gives the lowest prefix density across each pair’s three plans, divided by its density across the full v2 practice bank. The live General mode uses the 80-sentence v1 bank. The builder compares exact integer counts and the table shows rounded values.

In the 300 plans the first pair ends at characters 2–20. Each plan contains three distinct target words by character 240 and four complete passages by character 480. Plans contain 480–526 characters. All 144,025 prefixes from character 20 met the 1.25× threshold. The lowest ratio was 1.3619×. Spaces count within prompts and consecutive prompts contribute no extra separator.

A passage can serve multiple targets. Each target’s three plans use distinct passage IDs. The planner tries single-passage deletions until none preserves all of its constraints. It writes ordered witnesses to `ml/corpus/.cache/plan-witnesses.json`. Manual drills shuffle eligible dense passages. The prefix figures describe the ordered witnesses.

| Pair | Cutoff / 1,000 | Dense | Weakest × v2 practice |
| --- | ---: | ---: | ---: |
| th | 56.46 | 53 | 1.583 |
| he | 52.78 | 66 | 1.967 |
| in | 27.08 | 107 | 1.684 |
| ou | 28.37 | 87 | 2.185 |
| re | 25.98 | 100 | 1.442 |
| er | 25.15 | 113 | 1.838 |
| an | 19.07 | 124 | 1.547 |
| to | 17.41 | 120 | 1.529 |
| at | 17.50 | 124 | 1.580 |
| on | 17.59 | 119 | 1.362 |
| ng | 14.74 | 102 | 1.452 |
| ar | 13.91 | 125 | 1.461 |
| or | 17.13 | 95 | 1.558 |
| ha | 16.21 | 112 | 1.390 |
| ed | 15.84 | 104 | 1.976 |
| yo | 16.49 | 86 | 2.100 |
| st | 13.63 | 90 | 2.282 |
| es | 13.36 | 108 | 1.680 |
| te | 14.09 | 95 | 1.540 |
| is | 12.43 | 82 | 1.798 |
| ve | 14.09 | 84 | 1.972 |
| en | 12.53 | 89 | 1.897 |
| ea | 11.79 | 84 | 2.179 |
| nd | 11.15 | 83 | 1.964 |
| ne | 11.33 | 81 | 2.442 |
| hi | 10.50 | 79 | 2.769 |
| le | 10.59 | 92 | 1.684 |
| it | 11.24 | 75 | 2.371 |
| nt | 8.66 | 80 | 2.307 |
| me | 9.21 | 67 | 2.625 |
| ti | 9.21 | 85 | 1.976 |
| al | 9.86 | 69 | 2.807 |
| se | 10.22 | 64 | 3.047 |
| as | 8.75 | 68 | 2.805 |
| ca | 8.66 | 68 | 2.552 |
| ro | 9.03 | 56 | 3.556 |
| ee | 8.75 | 70 | 2.883 |
| ll | 9.76 | 67 | 2.885 |
| co | 10.04 | 64 | 3.057 |
| of | 8.20 | 59 | 3.251 |
| be | 7.55 | 61 | 3.030 |
| wa | 7.55 | 65 | 2.850 |
| ho | 8.66 | 62 | 3.348 |
| ta | 7.92 | 59 | 3.483 |
| et | 7.18 | 57 | 2.818 |
| la | 7.65 | 55 | 3.609 |
| fo | 8.11 | 50 | 3.492 |
| ur | 7.46 | 55 | 3.063 |
| de | 7.65 | 55 | 3.044 |
| ke | 7.74 | 47 | 4.125 |
| om | 7.55 | 47 | 3.823 |
| li | 7.46 | 49 | 4.184 |
| ri | 6.91 | 53 | 2.950 |
| ow | 6.72 | 59 | 3.583 |
| ch | 7.09 | 48 | 3.862 |
| do | 7.46 | 53 | 3.724 |
| ce | 6.91 | 44 | 3.795 |
| sh | 6.91 | 53 | 4.048 |
| we | 7.37 | 44 | 3.870 |
| el | 7.09 | 48 | 4.765 |
| ac | 6.36 | 40 | 4.630 |
| un | 5.90 | 38 | 5.134 |
| ey | 6.26 | 48 | 3.673 |
| lo | 6.36 | 41 | 5.413 |
| pe | 6.17 | 42 | 4.304 |
| ma | 5.53 | 41 | 4.461 |
| ra | 6.08 | 41 | 4.540 |
| oo | 6.17 | 38 | 4.684 |
| ic | 5.99 | 40 | 4.522 |
| us | 6.63 | 40 | 5.053 |
| di | 4.33 | 51 | 3.740 |
| wh | 5.16 | 40 | 4.801 |
| wi | 5.62 | 40 | 4.962 |
| ld | 4.51 | 42 | 7.187 |
| ns | 5.43 | 39 | 4.948 |
| so | 4.79 | 39 | 4.516 |
| ut | 4.79 | 39 | 4.572 |
| ul | 4.51 | 41 | 5.806 |
| pl | 4.97 | 39 | 5.396 |
| ad | 4.70 | 38 | 4.518 |
| il | 5.25 | 40 | 4.064 |
| si | 4.33 | 45 | 3.883 |
| wo | 4.24 | 40 | 4.174 |
| ot | 5.34 | 40 | 4.357 |
| ec | 5.53 | 38 | 5.396 |
| pa | 2.95 | 40 | 4.466 |
| ay | 4.51 | 39 | 5.053 |
| gh | 3.96 | 41 | 4.701 |
| ai | 4.24 | 39 | 4.315 |
| rs | 4.33 | 39 | 4.986 |
| ge | 3.87 | 39 | 4.315 |
| ts | 3.13 | 40 | 4.414 |
| av | 4.42 | 39 | 4.518 |
| no | 3.96 | 41 | 5.989 |
| ig | 3.13 | 41 | 3.795 |
| rt | 4.24 | 39 | 6.245 |
| ie | 3.87 | 37 | 6.034 |
| io | 3.87 | 38 | 4.689 |
| fe | 3.87 | 38 | 5.050 |
| ly | 3.68 | 39 | 4.408 |

## Random tone samples

Twenty draws per bank, without replacement, from files sorted by numeric source ID. Assessment sample seed 20261125. Practice sample seed 20261126.

| Assessment | Practice |
| --- | --- |
| and then everyone stood up and clapped | you can see the whole city skyline from here |
| can permanent marker stains be removed | coyotes are sometimes called prairie wolves |
| can you see the stars through the clouds | i just had another lesson last night |
| they love the sound of acoustic guitars | he imagined life on distant planets |
| the cat was meowing incessantly | she held the fan delicately between her fingers |
| did you copy and paste this from somewhere | i feel this way around the same time every year |
| they heard the howl of coyotes | i woke up with a cat sleeping next to my feet |
| the waves were perfect for surfing that day | elephants are among the most intelligent animals |
| i think the batteries need to be replaced | the train whistle echoed through the canyon |
| they constructed a new submarine | i could really use a helping hand |
| our teacher had us work in groups | they studied the depths of the ocean |
| the weather is supposed to be nice | they prepared for underwater research |
| they continued to meet on a regular basis | i prefer afternoons or evenings |
| it ended up being more complicated than that | the cat let out a plaintive meow |
| these are all important letters to read | did you come up with that yourself |
| i think that can be the case with a lot of things | i watched all three seasons in one night |
| we should take care of each other | do you know what they plan to do if they win |
| do you prefer live music over recordings | the rain tapped on the roof softly |
| i really dream of such a tree in my garden | he photographs the beauty of city life |
| what form of public transportation do you prefer | how much fruit is grown domestically |

## Reproduction checks

Run `python3.14 ml/corpus/build_banks.py` from the repository root in WSL. It uses the pinned source, the standard library and LF-normalised copies of the v1 corpus and coach config from `6ce7e02999c668454459da42ad5d832b5f13f9bf`. Two offline Python 3.14.4 builds used `PYTHONHASHSEED=17` and `91`. The second ran in a fresh temporary directory. All five outputs matched byte for byte.

| Output | SHA-256 |
| --- | --- |
| `assessment-bank-v2.json` (59,057 bytes, 13,359 gzip) | `b3425cbb22dcf1348f7a585c9ce0856b74428c0e1b49b18acff602313827bb39` |
| `practice-bank-v2.json` (40,793 bytes, 9,705 gzip) | `7d81862fbd48c471706098d30a203215915e632cb74f70f6fdbeeefcbacbba4f` |
| `manual-pairs-v2.json` | `8fcf4c67204212266dbec29e4a57a63f8f457cdec9eea2cc785c7916f40333d2` |
| `pair_frequencies.json` | `73053fe706308e95a04052ba8fe19dfaecb00079104f46af9cd2b6a31c9d1327` |
| `plan-witnesses.json` | `c14dc6fe5ed5aff8d0ff6bbe2d352224fb22d9db91142272562976b54f705342` |

Run `python3.14 -m unittest discover -s ml/corpus -v` from the repository root. All nine audits run with the source and witnesses cached. With an empty cache, two tests still check the committed counts, character lengths, unique and disjoint IDs, both exceptions, the frequency pin and density coverage for all 100 pairs. Six source audits and the witness audit then skip.
