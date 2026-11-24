# Full Aalto archive and fresh participant split

The locked fresh test set contains 16,659 typists. None of the 2,000 previously acquired participants is in fresh validation or test. The 300 original test typists have a separate locked directory. Assignment used participant IDs before any eligibility or speed calculation.

## Provenance

- Dhakal, Feit, Kristensson and Oulasvirta, *Observations on Typing from 136 Million Keystrokes*, CHI 2018. The dataset permits non-commercial use with attribution. [Aalto dataset](https://userinterfaces.aalto.fi/136Mkeystrokes/) · [Paper](https://doi.org/10.1145/3173574.3174220)
- Acquired 2026-11-24 UTC with `curl --continue-at - --retry 6` into a partial file on native WSL storage. The server advertised byte ranges and returned ETag `"5dbecd19-5688a4ae747c0"`. [Source ZIP](https://userinterfaces.aalto.fi/136Mkeystrokes/data/Keystrokes.zip)
- ZIP size 1,572,785,433 bytes. SHA256 `5fb217e0e1273017a6789c5c7ebcc00eed624f2f6426c284da2077a88e270420`. An independent streaming CRC pass verified all 168,597 members. The ingest also read every member to EOF and matched the SHA256 of each of the 2,002 prior-manifest members, including metadata and readme.
- Private WSL directory `/home/owenc/typeforge-data/aalto-136m`. It contains the ZIP, acquisition headers and the `ingest-v1/` snapshot. The original subset was read from `/mnt/c/Users/Owenc/Documents/GitHub/TypeForge/ml/data`.
- Full ingest took 19 min 27.90 s in one Python process. GNU time measured 263,332 KiB peak RSS (257.16 MiB). Available space before download and after ingest was 925.80 and 923.13 GiB on WSL, and 85.13 and 81.68 GiB on the shared Windows host.
- The 1.20 GiB snapshot has 662 shards. `ingest-v1/manifest.json` pins each shard, the split and the inventory. Its SHA256 is `ddb00d980b28ea2653b15d27010df051a23f37ce197d78228b175027d8fd528c`.

## Split and inventory

After excluding the prior 2,000, rank the 166,593 remaining source IDs by SHA256 of UTF-8 `fresh-2026-11:split:{pid}`. Use the lowest 16,659 for test, the next 16,659 for validation and the remaining 133,275 for train. Add the prior 1,700 train/validation participants to train. Keeping the prior 300 in `legacy_test` preserves their existing lock. There is no speed stratification. The public manifest pins the archive, prior acquisition manifest and four LF-terminated ID lists. [Split manifest](split-manifest.json)

| Partition | Assigned files | Valid files | Source data lines | Sharded keystrokes | Sharded trials |
| --- | --- | --- | --- | --- | --- |
| Train | 134,975 | 133,581 | 98,574,878 | 97,528,823 | 2,003,715 |
| Validation | 16,659 | 16,465 | 12,148,964 | 12,001,783 | 246,975 |
| Fresh test | 16,659 | 16,471 | 12,165,934 | 12,023,040 | 247,065 |
| Legacy test | 300 | 299 | 218,417 | 217,387 | 4,485 |
| Total | 168,593 | 166,816 | 123,108,193 | 121,771,033 | 2,502,240 |

Source data lines count physical records after each header, including malformed lines. The 121,771,033 validated keystrokes occupy 243,542,066 down/up slots. Whole-file exclusions were 1,442 invalid UTF-8 files and 335 malformed TSV files. No file failed required numeric validation. The full ZIP expands to 18,854,241,824 bytes. Participant member sizes range from 51,561 to 537,047 bytes, with a median of 110,545 bytes. The ZIP was read a member at a time.

The metadata covers all 168,593 participant files and contains one additional ID without a file. Layout counts are QWERTY 165,323, QWERTZ 1,979, AZERTY 1,082 and Dvorak 209. Keyboard counts are full 73,758, laptop 91,250, small 1,886 and on-screen 1,699. The v1 intersection of QWERTY and full/laptop contains 162,056 participants.

## Version 1 eligibility

V1 checks layout and keyboard first, then validates the participant file. Each trial takes its first applicable exclusion. The funnel pools all prompts and precedes any reserved-prompt or calibration-history split.

| Participant stage | Train | Validation |
| --- | --- | --- |
| Excluded by layout or keyboard | 5,229 | 663 |
| Supported layout and keyboard | 129,746 | 15,996 |
| Excluded for invalid UTF-8 among supported | 969 | 151 |
| Excluded for malformed TSV among supported | 251 | 26 |
| Supported and parsed | 128,526 | 15,819 |
| At least one eligible interval | 93,615 | 11,513 |

| Trial accounting | Train | Validation |
| --- | --- | --- |
| Trials entering v1 | 1,927,890 | 237,285 |
| Nonfinite press time | 0 | 0 |
| Final copy or repeated text disagrees | 533,093 | 65,587 |
| Unreconstructable edit or control | 964,426 | 118,579 |
| First-pass text differs | 37,272 | 4,585 |
| Nonincreasing printable press time | 34 | 6 |
| No eligible within-word pair | 0 | 0 |
| Eligible trials | 393,065 | 48,528 |
| Eligible keydown intervals (0, 5,000] ms | 7,956,151 | 984,555 |

## Development speed distribution

Each typist contributes one finite source `AVG_WPM_15`, the study's average over 15 sentences. All assigned train and validation typists have a finite value. Quantiles use linear interpolation and are shown to one decimal WPM. Thresholds are inclusive.

| Cohort | Typists | P10 | P25 | P50 | P75 | P90 | P99 | ≥100 | ≥150 | ≥180 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| All train | 134,975 | 26.1 | 35.0 | 48.3 | 64.1 | 78.4 | 102.6 | 1,828 | 1 | 0 |
| V1-eligible train | 93,615 | 28.5 | 37.8 | 51.5 | 66.7 | 80.7 | 104.1 | 1,545 | 1 | 0 |
| All validation | 16,659 | 26.4 | 35.1 | 48.8 | 64.4 | 78.6 | 102.7 | 234 | 0 | 0 |
| V1-eligible validation | 11,513 | 28.7 | 38.0 | 51.4 | 67.1 | 81.0 | 104.5 | 199 | 0 | 0 |

The v1 validation cohort provides 199 typists at or above 100 WPM. Validation coverage ends below 150 WPM. Neither development partition offers a 180 WPM example for evaluating transfer to a 190 WPM typist.

## Using the shards

Schema 1 stores up to 256 assigned participants per split-specific NPZ. Use `train/` and `validation/` for development. A zero-based `participant_index` addresses that split's lexical `ids.txt`, including indices reserved for invalid files. A zero-based `trial_index` addresses the shard's `trials_json` table. Each array is readable with `np.load(path, allow_pickle=False)`.

| Fields | Contents |
| --- | --- |
| `participant_index`, `trial_index`, `letter_index` | Unsigned 32-bit indices per event. `letter_index` addresses `letters_json`, preserving source text and controls. |
| `timestamp_ms`, `is_press`, `keycode`, `keystroke_id` | Adjacent down/up rows for every source keystroke, with the original timestamps as float64, a boolean press flag, a signed 32-bit JavaScript keycode and the original numeric stroke ID as float64. |
| `trials_json` | Each row holds participant index, original section ID, target text, final input, layout, keyboard type and a boolean indicating whether all rows agree on both text fields. |
| `letters_json`, `trials_json` | UTF-8 JSON in uint8 arrays. Decode with `json.loads(z["trials_json"].tobytes())` or the corresponding letters field. |

The TSV decoder and v1 audit follow `ml/pipeline.py` at `6ce7e02999c668454459da42ad5d832b5f13f9bf`. Decoding uses UTF-8 with optional BOM, universal record endings, tabs and no quoting. A malformed row, invalid UTF-8 or invalid required number excludes the entire participant. Intake additionally retains valid rows from unsupported keyboards/layouts and corrected trials for later filtering. Unparseable release times become NaN. V1 only uses press times.

Stored events preserve source order within each trial. The trial table keeps the first source text fields and marks any inconsistent repetition. To reproduce v1 chronology, sort trials by minimum press time and section ID, then keydowns by press time and stroke ID. The v1 funnel counts adjacent lowercase ASCII pairs after exact reconstruction, so counting them directly is equivalent to enumerating them within maximal ASCII words. Both test partitions take only the structural ingest path.

## Reproduction and checks

Branch `OwenC05/tf-full-archive`. The snapshot ran at `3d3024a92223343c85608b7297b4a8efd90f5bbe` and the public split was locked at `c7c1db21ae10f2828295fb7da9dddc4d691554f8`. A subsequent parser fix at `07a9b3f2aff2205dd55a161108f16bd800e73563` covers absent optional columns and empty headers. An independent scan found the canonical header in all 168,593 participant files and all requested metadata columns exactly once. Both parser revisions decode those schemas identically. The private copy at `/home/owenc/typeforge-data/aalto-136m/REPORT.md` records the final report commit.

Run from the worktree root under WSL with Python 3.14.4, NumPy 2.5.3 and zlib 1.3.1.

```sh
A8_DATA=/home/owenc/typeforge-data/aalto-136m
A8_OLD=/mnt/c/Users/Owenc/Documents/GitHub/TypeForge/ml/data
A8_PY=/mnt/c/Users/Owenc/Documents/GitHub/TypeForge/.venv/bin/python
umask 077
export OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1
(cd "$A8_DATA" && sha256sum -c archive.sha256)
"$A8_PY" -m zipfile -t "$A8_DATA/Keystrokes.zip"
"$A8_PY" -m unittest -v ml.full_archive.test_ingest
"$A8_PY" -m unittest discover -s ml/tests -v
"$A8_PY" -m ml.full_archive.ingest "$A8_DATA/Keystrokes.zip" "$A8_OLD/manifest.json" "$A8_DATA/ingest-v1-rebuild"
PYTHONPATH=. "$A8_PY" "$A8_DATA/verify-a8.py" "$A8_DATA" "$A8_OLD"
```

All four archive regression tests and all 21 existing ML tests passed. The independent verifier matched all 662 shard digests, four ID-list hashes and all 168,593 assignments. Replaying the 1,700 historical development assignments from train shards reproduced the frozen v1 audit's 4,985 eligible trials and all 100,978 observations exactly. The reference `rows.json` file SHA256 is `8adf07d3f4538899a0cc295395127b522a9c289c6fca4bd98be93edbb8870193`.

The verifier also matched both events and text for 5,851 original keystrokes from eight training typists. Independent interpolation from source metadata reproduced all six quantiles and all three threshold counts for train and validation. The test partitions have structural counts only.
