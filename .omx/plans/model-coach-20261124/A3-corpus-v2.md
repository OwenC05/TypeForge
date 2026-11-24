A3 Practice and assessment banks v2 from an openly licensed corpus, with pair frequencies

Read `.omx/plans/model-coach-20261124/common.md` and `plan.md` first. You are worker A3. No port.

## Why

The app ships 80 practice and 40 assessment sentences (`typing-app/client/src/corpus.ts`): lowercase a-z and single spaces, about 36 to 60 characters, everyday and pleasant, British spelling ("neighbours"). A 190 WPM typist uses about 16 sentences a minute, so banks cycle fast. The new coach (plan.md) may target any frequent within-word letter pair, so practice text must be dense in each candidate pair, and the pilot needs plenty of fresh, untargeted assessment text.

## Deliverables

1. Source and licence. Pick an English sentence source whose licence allows redistribution in a public GitHub repository and on a public website. Prefer CC0 or public domain; CC BY is acceptable with attribution; avoid NC and ND, and avoid SA unless nothing else works. Evaluate at least Tatoeba (per-sentence licences, CC BY 2.0 FR with a CC0 subset), Simple English Wikipedia and public-domain books. Record the decision with links and licence text. Pin the exact download (URL, date, size, SHA256). Cache the source outside git (gitignored `ml/corpus/.cache/` or the user cache).
2. Deterministic build tool `ml/corpus/build_banks.py` (Python 3.14 in WSL, standard library only if feasible, seeded, re-runnable offline from the cache). Filters, each counted in a funnel: convert to lowercase a-z plus single spaces only, dropping any sentence that needs more than case-folding to fit (no digits, no punctuation inside words, no apostrophes, so contractions drop rather than being mangled); length within the current bank's band (measure it, then allow modestly wider, for example 30 to 70 characters); no proper nouns (drop sentences with capitalised words that are not sentence-initial in the source); a blocklist for profanity, violence, sexual content, politics, religion and medical topics; common vocabulary (for example at least 95% of tokens within the corpus's 20,000 most frequent words); house style (drop sentences with US-only spellings from a small list such as color, favorite, center, organize, rather than rewriting text); exact and near-duplicate removal; no overlap with the current banks.
3. Banks. `assessment-bank-v2`: sampled uniformly at random from the filtered pool (never selected by pair content; assessment text must not be chosen to make anyone look better), about 600 to 1,000 sentences. `practice-bank-v2`: disjoint from assessment, selected to meet the density targets, about 3,000 to 6,000 sentences. Keep both within a sensible size for a static site (target at most about 250 KB gzipped together; report actual sizes).
4. Density targets. Candidate pairs: within-word lowercase bigrams ranked by frequency in the filtered pool, top 150 or those covering 95% of within-word bigram occurrences, whichever is smaller. For each, the practice bank needs at least 16 distinct sentences whose pair density (occurrences per character) is at least 2x the pair's density in the assessment bank, and enough of them to build at least 3 non-overlapping plans under the current exposure rules in `typing-app/client/src/coach-config.json` (`exposure`: 480 to 600 plan characters, first target by character 20, at least 4 passages, at least 1.25x general density). Report every pair that misses.
5. Pair frequencies `ml/corpus/pair_frequencies.json`: frequency per within-word bigram in general English text (from the assessment-like uniform sample or the full filtered pool; say which), with the source hash. The coach uses it to weight expected time lost.
6. Outputs: `typing-app/client/src/generated/practice-bank-v2.json` and `assessment-bank-v2.json` (`{version, source, licence, sha256, sentences: [{id, text}]}`, stable ids), and `typing-app/client/src/generated/CORPUS-ATTRIBUTION.md` with everything the licence requires. Do not edit `corpus.ts` or any app code; phase B integrates the banks.
7. Report `ml/corpus/REPORT.md` (at most 200 lines): licence decision, funnel counts, length distribution against the current bank, density coverage per pair, gaps, sizes, and 40 randomly sampled sentences from each bank (seeded) so the coordinator can judge tone and readability.

## Owned paths

`ml/corpus/**`, the three generated files named above, and `.gitignore` (one line for your cache only).

## Done when

The build reproduces byte-identical bank files from the cached source on a second run (show both hashes), the report is committed and `worker_done` follows common.md. If no source meets the licence bar, stop and ask the coordinator before using a weaker licence.
