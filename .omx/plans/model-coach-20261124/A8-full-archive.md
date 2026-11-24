A8 Full Aalto archive: download, verify, inventory, streaming ingest and a fresh locked split

Read `.omx/plans/model-coach-20261124/common.md` and `plan.md` first. You are worker A8. No port. CPU-heavy: at most 6 processes.

## Why

The current model was trained on 2,000 of the archive's participants and its main test slice has only three typists above 100 WPM. Phase B retrains a ladder of models on the full archive and needs a genuinely untouched test set. Dataset terms: non-commercial use with attribution (see `ml/README.md`, "Source and acquisition"). Never commit or upload raw data, participant IDs or per-participant records.

## Deliverables

1. Download `https://userinterfaces.aalto.fi/136Mkeystrokes/data/Keystrokes.zip` (about 1.57 GB) with resume support into a data directory outside git. Prefer the WSL native filesystem for speed (for example `~/typeforge-data/aalto-136m/`) and record the absolute path. Record URL, date, size, ETag and SHA256. Verify every member's CRC by streaming; do not extract everything unless free space clearly allows (report free space before and after).
2. Inventory: participant files, total rows and keystrokes, metadata distributions (layout, keyboard type, other fields), size statistics, malformed or invalid files, and overlap with the 2,000-participant subset (its member list is in the subset's manifest under the original checkout's `ml/data`; read-only).
3. Streaming ingest `ml/full_archive/ingest.py`: parse with exactly the rules of `ml/pipeline.py` (`tsv`, `audit`) and document any difference. Another worker is restructuring `ml/pipeline.py` now, so copy the minimal parsing you need into your module and note where it came from; phase B unifies them. Output compact, versioned shards (for example NumPy `.npz` per block of participants) holding, per keystroke, participant index, trial index, timestamp, a key code and a press flag, and per trial the target text, final input and metadata. Write a manifest with a schema version and a SHA256 per shard. Must run within 64 GB RAM by streaming; report runtime and peak memory.
4. Fresh split. Exclude all 2,000 previously acquired participants from the fresh test set (they may go to train). Rank the remaining participants by `sha256("fresh-2026-11:split:{pid}")` and assign test 10%, validation 10%, train 80%; you may stratify by speed band if you justify it. Store the ID lists outside git. Commit only `ml/full_archive/split-manifest.json` with counts, the rule, and hashes of the ID lists.
5. Report `ml/full_archive/REPORT.md` (at most 200 lines): provenance, inventory, ingest schema, runtime, the eligibility funnel under the current version 1 rule, and the speed distribution of train and validation typists (WPM quantiles, counts at or above 100, 150 and 180 WPM). For test participants report counts only; compute no timing or speed statistics on them.

## Owned paths

`ml/full_archive/**` and `.gitignore` (data-path lines only). Data lives outside the repository.

## Done when

The archive verifies, the ingest runs end to end on the full archive (or, if that is impossible here, on as much as possible with the blocker stated), the split manifest and report are committed, and `worker_done` follows common.md with the data directory path, shard count and manifest hash.
