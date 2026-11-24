"""Build the two development datasets from the pinned Aalto ingest and eligibility v2."""

import filecmp
import json
import math
import shutil
import subprocess
import tempfile
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

from .analysis.eligibility_v2_bias import LOWER_EDGES, WINDOWS, bucket
from .config import ROOT, read_json, write_json
from .eligibility_v2 import METRIC_VERSION, eligible, replay_aalto
from .features import _pair_index
from .full_archive.ingest import sha_file
from .parse import tsv
from .split import partition_participants

INGEST_SHA256 = "ddb00d980b28ea2653b15d27010df051a23f37ce197d78228b175027d8fd528c"
HISTORICAL_COUNTS = (1700, 100906)
SPLITS = ("train", "validation")
WIDEST_WINDOW = LOWER_EDGES > max(WINDOWS)
INTERVAL = np.dtype([
    ("interval_typist", "<u4"), ("interval_trial_order", "<u4"), ("interval_pair", "<u2"),
    ("interval_position", "<u4"), ("interval_log_ms", "<f8"),
])
TRIAL = np.dtype([
    ("trial_typist", "<u4"), ("trial_order", "<u4"),
    ("trial_reason", "u1"), ("trial_sentence", "<u4"),
])


def _check_hash(path, expected):
    if sha_file(path) != expected:
        raise ValueError(f"SHA256 mismatch for {path}")


def _code_commit():
    # WSL Git cannot resolve a gitdir pointer written by Windows Git in a linked worktree.
    for name in ("git", "git.exe"):
        if executable := shutil.which(name):
            result = subprocess.run([executable, "rev-parse", "--verify", "HEAD"], cwd=ROOT,
                                    capture_output=True, text=True)
            if result.returncode == 0:
                return result.stdout.strip()
    raise RuntimeError("Cannot identify the code commit for this dataset")


def _replay_shard(job):
    path, expected_hash, keep_corrected = job
    _check_hash(path, expected_hash)
    with np.load(path, allow_pickle=False) as shard:
        trials = json.loads(shard["trials_json"].tobytes())
        letters = json.loads(shard["letters_json"].tobytes())
        # Schema 1 stores each press immediately before its release, grouped by trial.
        bounds = np.searchsorted(shard["trial_index"][::2], np.arange(len(trials) + 1)).tolist()
        times, strokes, codes, chars = (shard[key][::2].tolist() for key in
                                        ("timestamp_ms", "keystroke_id", "keycode", "letter_index"))

    def chronology(i):
        return trials[i][0], min(times[bounds[i]:bounds[i + 1]]), trials[i][1]

    clean, corrected, outcomes = [], [], []
    previous = None
    order = -1
    for i in sorted(range(len(trials)), key=chronology):
        typist, section, target, final, layout, keyboard, consistent = trials[i]
        order = order + 1 if typist == previous else 0
        previous = typist
        # A8's consistency bit is the surviving evidence of conflicting source text.
        # An empty row list sends that trial through A2's layout/invalid-trial gates.
        rows = []
        if consistent:
            rows = [
                {"PARTICIPANT_ID": typist, "TEST_SECTION_ID": section, "SENTENCE": target,
                 "USER_INPUT": final, "PRESS_TIME": times[j], "KEYCODE": codes[j],
                 "KEYSTROKE_ID": strokes[j] if strokes[j].is_integer() else str(strokes[j]),
                 "LETTER": letters[chars[j]]}
                for j in range(bounds[i], bounds[i + 1])
            ]
        replay = replay_aalto(rows, layout=layout, keyboard_type=keyboard)
        result = eligible(replay)
        outcomes.append((typist, order, result["reason"], target))
        clean.extend((typist, order, _pair_index(m["pair"]), m["toIndex"], math.log(m["ms"]))
                     for m in result["intervals"])
        if keep_corrected and result["reason"] == "clean-copy-required":
            corrected.extend(
                (typist, order, _pair_index(m.pair), m.end, math.log(m.ms))
                for m in replay.measurements if m.first and not m.error
                and WIDEST_WINDOW[bucket(m.post)] and WIDEST_WINDOW[bucket(m.pre)]
            )
    return np.array(clean, dtype=INTERVAL), np.array(corrected, dtype=INTERVAL), outcomes


def _records(stream, dtype):
    if stream.tell() == 0:
        return np.empty(0, dtype=dtype)
    stream.flush()
    return np.memmap(stream, mode="r", dtype=dtype)


def _columns(records):
    return {name: records[name] for name in records.dtype.names}


def _build_split(pool, snapshot, entries, stage, split, speeds, historical_indices):
    jobs = [(snapshot / entry["path"], entry["sha256"], split == "validation")
            for entry in entries if Path(entry["path"]).parent == Path(split)]
    reasons, sentences = {"": 0}, {}
    # Spool shard results in manifest order. The full event stream and interval table
    # need never fit in RAM, and process completion order cannot affect file bytes.
    with (tempfile.TemporaryFile(dir=stage) as clean_file,
          tempfile.TemporaryFile(dir=stage) as corrected_file,
          tempfile.TemporaryFile(dir=stage) as trial_file):
        for clean, corrected, outcomes in pool.map(_replay_shard, jobs, buffersize=6):
            clean.tofile(clean_file)
            corrected.tofile(corrected_file)
            encoded = [(p, order, reasons.setdefault(reason or "", len(reasons)),
                        sentences.setdefault(sentence, len(sentences)))
                       for p, order, reason, sentence in outcomes]
            np.array(encoded, dtype=TRIAL).tofile(trial_file)

        trials = _records(trial_file, TRIAL)
        intervals = _records(clean_file, INTERVAL)
        corrected = _records(corrected_file, INTERVAL)
        people = len(speeds)
        replayed = np.bincount(trials["trial_typist"], minlength=people)
        accepted = np.bincount(trials["trial_typist"][trials["trial_reason"] == 0], minlength=people)
        counts = np.bincount(intervals["interval_typist"], minlength=people)
        np.savez_compressed(
            stage / f"{split}.npz", allow_pickle=False, **_columns(intervals), **_columns(trials),
            sentences=np.array(list(sentences), dtype=str), reason_labels=np.array(list(reasons)),
            typist_index=np.arange(people, dtype="<u4"), typist_avg_wpm_15=speeds,
            typist_trials_replayed=replayed.astype("<u4"), typist_trials_eligible=accepted.astype("<u4"),
        )
        if split == "validation":
            np.savez_compressed(stage / "validation-corrected.npz", allow_pickle=False, **_columns(corrected))
        rejected = np.bincount(trials["trial_reason"], minlength=len(reasons))
        summary = {
            "typists": people, "typistsReplayed": int(np.count_nonzero(replayed)),
            "typistsWithIntervals": int(np.count_nonzero(counts)), "trialsReplayed": len(trials),
            "trialsEligible": int(accepted.sum()), "intervals": len(intervals),
            "rejectionsByReason": {r: int(rejected[i]) for r, i in reasons.items() if r},
        }
        if split == "validation":
            summary["correctedIntervals"] = len(corrected)
        return summary, int(counts[historical_indices].sum())


def build_dataset_v2(data_dir: Path, prior_data_dir: Path) -> None:
    """Publish a complete dataset, or compare a fresh replay with the existing one."""
    snapshot = data_dir / "ingest-v1"
    _check_hash(snapshot / "manifest.json", INGEST_SHA256)
    manifest = read_json(snapshot / "manifest.json")
    _check_hash(snapshot / "split-manifest.json", manifest["splitManifestSha256"])
    assignment = read_json(snapshot / "split-manifest.json")
    groups = {}
    for split in SPLITS:
        source = snapshot / split / "ids.txt"
        _check_hash(source, assignment["splits"][split]["sha256"])
        groups[split] = source.read_text(encoding="utf-8").splitlines()

    prior_manifest = prior_data_dir / "manifest.json"
    _check_hash(prior_manifest, assignment["priorManifestFileSha256"])
    prior = read_json(prior_manifest)
    members = {Path(m["name"]).name: m["sha256"] for m in prior["members"]}
    prior_ids = [name.removesuffix("_keystrokes.txt") for name in members if name.endswith("_keystrokes.txt")]
    historical = {p for p, s in partition_participants(prior_ids, prior["seed"]).items() if s in SPLITS}
    historical_indices = [i for i, p in enumerate(groups["train"]) if p in historical]
    if len(historical_indices) != len(historical):
        raise ValueError("Historical development typists missing from train")
    allowed = set(groups["train"]).union(groups["validation"])
    metadata = prior_data_dir / "raw" / "metadata_participants.txt"
    _check_hash(metadata, members[metadata.name])
    wpm = {r["PARTICIPANT_ID"]: float(r["AVG_WPM_15"]) for r in tsv(metadata)
           if r["PARTICIPANT_ID"] in allowed}
    meta = {
        "metricVersion": METRIC_VERSION, "codeCommit": _code_commit(), "inputManifestSha256": INGEST_SHA256,
        "splitManifestSha256": manifest["splitManifestSha256"], "metadataSha256": members[metadata.name],
        "priorManifestSha256": assignment["priorManifestFileSha256"], "splits": {},
    }
    destination = data_dir / "dataset-v2"
    with tempfile.TemporaryDirectory(dir=data_dir, prefix=".dataset-v2-") as temp:
        stage = Path(temp) / destination.name
        stage.mkdir()
        with ProcessPoolExecutor(max_workers=3) as pool:
            for split in SPLITS:
                speeds = np.array([wpm[p] for p in groups[split]], dtype="<f8")
                summary, historical_count = _build_split(
                    pool, snapshot, manifest["shards"], stage, split, speeds,
                    historical_indices if split == "train" else [],
                )
                meta["splits"][split] = summary
                if split == "train":
                    if (len(historical_indices), historical_count) != HISTORICAL_COUNTS:
                        raise ValueError(f"Historical development cross-check failed: "
                                         f"{len(historical_indices)} typists, {historical_count} intervals")
                    meta["historicalDevelopment"] = {"typists": len(historical_indices), "intervals": historical_count}
                print(f"{split}: {summary['trialsReplayed']} trials, {summary['intervals']} clean intervals", flush=True)
        meta["files"] = {p.name: sha_file(p) for p in sorted(stage.glob("*.npz"))}
        write_json(stage / "meta.json", meta)
        try:
            stage.rename(destination)
        except OSError:
            if not destination.is_dir():
                raise
            for path in stage.iterdir():
                if not filecmp.cmp(path, destination / path.name, shallow=False):
                    raise ValueError(f"Rebuild differs from {destination / path.name}")
            print("Verified byte-identical rebuild of all four dataset files", flush=True)
