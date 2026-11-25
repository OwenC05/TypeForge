"""Build and score one registered clean split. Validation exercises the same B6 path."""

import argparse
import csv
import json
import math
import os
from concurrent.futures import ProcessPoolExecutor
from importlib import import_module
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np

from .validation import CORPUS, RIDGE, coach_inputs, file_hash, fit_training, score_split, text_hash

REFERENCE = Path(__file__).with_name("validation.json")
PINS = {
    "builder_LF": "b5281e63df79f62ddda6ed2ef88f94fefabc1d603dd29ff8b1daa52c76cdf6ae",
    "model.py_LF": "7a28fd849d0d8206cb529f15bddde0b2cf6433f3b8205c521ee1765cc9646de2",
    "replay.py_LF": "122f9496f9297150c2396f32a2aa2f848752ddcc1ce651befd8f0705656a370f",
    "validation.py_LF": "2485200744c574b2bc76c323d4970b42b00a73dc792d7901f3fc4ab2bf8d9784",
    "manifest.json": "ddb00d980b28ea2653b15d27010df051a23f37ce197d78228b175027d8fd528c",
    "split-manifest.json": "36e3e0db0db4f5d5877504a1fefe0c8ce7948a156a392aefa94ee13835732be8",
    "test/ids.txt": "08bea7236ee36461e239e6190e02ff9c893b067733ed8ae7078c3bf6a6f69699",
    "validation/ids.txt": "bf8b847824a3ec8f21b4982bb7bd3c4207fb5393f4b98e769237a381df1dff48",
    "metadata_participants.txt": "3ba22e2c23dbcbb5645197b9dd68c17e9ef68a1be7170e1bc1f0cd869a68ac6d",
    "train.npz": "4ee076d14840e8ef9d5f8c69e2a35b20618567a44316e84df2003a28b4cc7b16",
    "pair_frequencies.json_LF": "73053fe706308e95a04052ba8fe19dfaecb00079104f46af9cd2b6a31c9d1327",
    "model.json_LF": "7ffce48105ac2dc9c9915d01f9277a7f4b7cfeca6d0377ce8d44a8d70536a836",
    "fitted_model": "c813005bd99f23fc88b9370490eb8dffa1792c57d5151d23b07047477fe85158",
    "validation.npz": "1924228510dbf4a84c93f2d097bddd2e7503b3455c8a7762d350bea4f5dbed94",
    "validation.json_LF": "ef88838cd24c4edde0eecb9967239cee9b94847b6dddc2766d250b18687f88b0",
}


def require_pin(name, actual):
    if actual != PINS[name]:
        raise ValueError(f"Registered SHA256 mismatch for {name}")
    return actual


def roster_wpm(roster, metadata):
    """Keep lexical roster order. Only parse WPM values belonging to this assignment."""
    positions = {pid: i for i, pid in enumerate(roster)}
    speeds = np.full(len(roster), np.nan, dtype="<f8")
    with metadata.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream, delimiter="\t", quoting=csv.QUOTE_NONE):
            i = positions.get(row.get("PARTICIPANT_ID"))
            if i is not None:
                try:
                    value = float(row.get("AVG_WPM_15", ""))
                except (TypeError, ValueError):
                    value = math.nan
                speeds[i] = value if math.isfinite(value) else math.nan
    return speeds


def check_validation(scores, training, reference):
    expected = {k: v for k, v in reference.items() if k not in ("input_sha256", "training")}
    expected["bands"] = {
        band: {key: value for key, value in metrics.items()
               if key not in ("D2_yield", "D2_hit", "D2_issued", "mae_D2", "gain_D2")}
        for band, metrics in reference["bands"].items()
    }
    if expected != scores or training != reference["training"]:
        raise ValueError("Clean validation replay differs from the frozen validation results")


def run(mode, archive, metadata, output):
    split = {"validation": "validation", "fresh": "test"}[mode]
    receipt = output.with_name(output.name + ".input.sha256")
    if not output.parent.is_dir():
        raise FileNotFoundError(output.parent)
    for target in (output, receipt):
        if os.path.lexists(target):
            raise FileExistsError(f"Output already exists: {target}")

    snapshot = archive / "ingest-v1"
    train = archive / "dataset-v2" / "train.npz"
    builder = import_module("ml.dataset_v2")
    if builder.__file__ is None:
        raise ValueError("The registered B3 builder requires its source file")
    roster_name = f"{split}/ids.txt"
    inputs = {
        "builder_LF": require_pin("builder_LF", text_hash(Path(builder.__file__))),
        "manifest.json": require_pin("manifest.json", file_hash(snapshot / "manifest.json")),
        "split-manifest.json": require_pin("split-manifest.json",
                                           file_hash(snapshot / "split-manifest.json")),
        "metadata_participants.txt": require_pin("metadata_participants.txt", file_hash(metadata)),
        "train.npz": require_pin("train.npz", file_hash(train)),
        "pair_frequencies.json_LF": require_pin("pair_frequencies.json_LF", text_hash(CORPUS)),
        "model.json_LF": require_pin("model.json_LF", text_hash(RIDGE)),
    }
    for name in ("model.py", "replay.py", "validation.py"):
        key = name + "_LF"
        inputs[key] = require_pin(key, text_hash(Path(__file__).with_name(name)))
    reference = None
    if mode == "validation":
        inputs["validation.json_LF"] = require_pin("validation.json_LF", text_hash(REFERENCE))
        reference = json.loads(REFERENCE.read_bytes())
    model, limited, stats = fit_training(train)
    inputs["fitted_model"] = require_pin("fitted_model", stats["model_sha256"])
    ridge, frequency = coach_inputs()

    manifest = json.loads((snapshot / "manifest.json").read_bytes())
    require_pin("split-manifest.json", manifest["splitManifestSha256"])
    assignment = json.loads((snapshot / "split-manifest.json").read_bytes())["splits"][split]
    require_pin(roster_name, assignment["sha256"])
    roster_file = snapshot / roster_name
    inputs[roster_name] = require_pin(roster_name, file_hash(roster_file))
    roster = roster_file.read_text(encoding="utf-8").splitlines()
    if len(roster) != assignment["participants"] or roster != sorted(set(roster)):
        raise ValueError("Assignment roster must be complete, unique and lexically ordered")
    speeds = roster_wpm(roster, metadata)

    with TemporaryDirectory(dir=output.parent, prefix=".coach-build-") as directory:
        stage = Path(directory)
        with ProcessPoolExecutor(max_workers=3) as pool:
            builder._build_split(pool, snapshot, manifest["shards"], stage, split, speeds, [])
        clean = stage / f"{split}.npz"
        digest = file_hash(clean)
        if mode == "validation":
            require_pin("validation.npz", digest)
        # Publish the input identity before scoring. Exclusive links also protect competing runs.
        checksum = stage / "input.sha256"
        checksum.write_text(f"{digest}  {clean.name}\n", encoding="ascii")
        os.link(checksum, receipt)
        print(f"Recorded {clean.name} SHA256 {digest}", flush=True)
        with np.load(clean, allow_pickle=False) as data:
            scores = score_split(model, limited, ridge, frequency, data)
        if reference is not None:
            check_validation(scores, stats, reference)
        result = {"mode": mode, "input_sha256": inputs, "clean_npz_sha256": digest,
                  "training": stats, **scores}
        completed = stage / "results.json"
        completed.write_text(json.dumps(result, allow_nan=False, indent=2) + "\n", encoding="utf-8")
        os.link(completed, output)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("validation", "fresh"))
    parser.add_argument("archive", type=Path, help="A8/B3 root containing ingest-v1 and dataset-v2")
    parser.add_argument("metadata", type=Path, help="Pinned raw/metadata_participants.txt")
    parser.add_argument("output", type=Path, help="New result JSON in an existing directory")
    args = parser.parse_args()
    run(args.mode, args.archive, args.metadata, args.output)


if __name__ == "__main__":
    main()
