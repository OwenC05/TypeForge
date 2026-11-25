"""End-to-end development replay using tiny synthetic A8 shards."""

import math
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

from ml import dataset_v2
from ml.cli import main
from ml.config import read_json, write_json
from ml.full_archive.ingest import Shard, Trial, sha_file
from ml.split import partition_participants


def trial(target, keys, start, *, consistent=True):
    strokes = []
    for i, letter in enumerate(keys):
        press = start + i * 10.5
        code = 8 if letter == "<" else ord(letter.upper())
        strokes.append((press, i, press + 900, code, letter))
    return Trial(target, target, consistent, strokes[::-1])


def fixture(root):
    prior = root / "prior"
    (prior / "raw").mkdir(parents=True)
    historical, locked = sorted(("old0", "old1"),
                                key=lambda p: partition_participants(("old0", "old1"))[p] == "test")
    metadata = prior / "raw" / "metadata_participants.txt"
    metadata.write_text(f"PARTICIPANT_ID\tAVG_WPM_15\n{historical}\t40.5\nunused\t20\n"
                        f"unsupported\t100\nnew\t120\n{locked}\tlocked\n", encoding="utf-8")
    write_json(prior / "manifest.json", {
        "seed": 42, "members": [{"name": metadata.name, "sha256": sha_file(metadata)},
                               *({"name": f"{pid}_keystrokes.txt", "sha256": "unused"}
                                 for pid in (historical, locked))],
    })
    ingest = root / "ingest-v1"
    splits = {"priorManifestFileSha256": sha_file(prior / "manifest.json"), "splits": {}}
    shards = []
    for split, people in (("train", [historical, "unsupported", "unused"]), ("validation", ["new"])):
        folder = ingest / split
        folder.mkdir(parents=True)
        ids = folder / "ids.txt"
        ids.write_text("".join(p + "\n" for p in people), encoding="utf-8")
        splits["splits"][split] = {"sha256": sha_file(ids), "participants": len(people)}
        shard = Shard()
        if split == "train":
            shard.add(0, {
                "last": trial("aBcd", "aBcd", 200), "2": trial("cat", "cat", 10),
                "10": trial("A", "A", 10), "bad": trial("ab", "ab", 150, consistent=False),
            }, "qwerty", "full")
            shard.add(1, {"x": trial("ab", "ab", 0, consistent=False)}, "azerty", "full")
        else:
            target = "abcdefghijklmnopqrstuvwx"
            keys = target[:12] + "z<" + target[12:]
            shard.add(0, {"edit": trial(target, keys, 100), "clean": trial("ab", "ab", 0)},
                      "qwerty", "laptop")
        entry = shard.save(folder / "0000.npz")
        entry["path"] = f"{split}/0000.npz"
        shards.append(entry)
    # Both locked paths intentionally have no directory, ID list or shard to open.
    shards.extend({"path": f"{name}/0000.npz"} for name in ("test", "legacy_test"))
    write_json(ingest / "split-manifest.json", splits)
    write_json(ingest / "manifest.json", {"shards": shards,
               "splitManifestSha256": sha_file(ingest / "split-manifest.json")})
    return prior, sha_file(ingest / "manifest.json")


class DatasetTests(unittest.TestCase):
    def test_cli_replays_chronology_and_both_correction_boundaries(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            prior, manifest_hash = fixture(root)
            output = root / "dataset-v2"
            args = ["dataset-v2", "--data-dir", str(root), "--prior-data-dir", str(prior)]
            with (patch.object(dataset_v2, "INGEST_SHA256", manifest_hash),
                  patch.object(dataset_v2, "HISTORICAL_COUNTS", (1, 3))):
                main(args)
                hashes = {p.name: sha_file(p) for p in output.iterdir()}
                main(args)
                self.assertEqual(hashes, {p.name: sha_file(p) for p in output.iterdir()})
            meta = read_json(output / "meta.json")
            self.assertEqual(meta["inputManifestSha256"], manifest_hash)
            self.assertEqual(meta["metricVersion"], 2)
            self.assertEqual(meta["historicalDevelopment"], {"typists": 1, "intervals": 3})
            self.assertEqual(meta["files"], {k: v for k, v in hashes.items() if k.endswith(".npz")})
            self.assertEqual(meta["splits"]["train"]["rejectionsByReason"],
                             {"invalid-trial": 1, "unsupported-layout": 1})
            with np.load(output / "train.npz", allow_pickle=False) as data:
                np.testing.assert_array_equal(data["typist_index"], [0, 1, 2])
                np.testing.assert_array_equal(data["typist_trials_replayed"], [4, 1, 0])
                np.testing.assert_array_equal(data["typist_trials_eligible"], [3, 0, 0])
                np.testing.assert_array_equal(data["typist_avg_wpm_15"], [40.5, 100, 20])
                np.testing.assert_array_equal(data["trial_order"], [0, 1, 2, 3, 0])
                np.testing.assert_array_equal(data["sentences"][data["trial_sentence"]],
                                              ["A", "cat", "ab", "aBcd", "ab"])
                np.testing.assert_array_equal(data["reason_labels"][data["trial_reason"]],
                                              ["", "", "invalid-trial", "", "unsupported-layout"])
                np.testing.assert_array_equal(data["interval_trial_order"], [1, 1, 3])
                np.testing.assert_array_equal(data["interval_pair"], [52, 19, 55])
                np.testing.assert_array_equal(data["interval_position"], [1, 2, 3])
                np.testing.assert_allclose(data["interval_log_ms"], math.log(10.5), rtol=0, atol=0)
            with np.load(output / "validation.npz", allow_pickle=False) as data:
                np.testing.assert_array_equal(data["interval_trial_order"], [0])
                self.assertEqual(data["reason_labels"][data["trial_reason"][1]], "clean-copy-required")
            with np.load(output / "validation-corrected.npz", allow_pickle=False) as extra:
                self.assertEqual(set(extra.files), set(dataset_v2.INTERVAL.names))
                np.testing.assert_array_equal(extra["interval_position"], [1, 2, 22, 23])
                np.testing.assert_array_equal(extra["interval_trial_order"], [1] * 4)
                np.testing.assert_allclose(extra["interval_log_ms"], math.log(10.5), rtol=0, atol=0)

    def test_bad_shard_cannot_publish_a_partial_dataset(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            prior, manifest_hash = fixture(root)
            (root / "ingest-v1/validation/0000.npz").write_bytes(b"corrupt")
            with (patch.object(dataset_v2, "INGEST_SHA256", manifest_hash),
                  patch.object(dataset_v2, "HISTORICAL_COUNTS", (1, 3)),
                  self.assertRaisesRegex(ValueError, "SHA256 mismatch")):
                dataset_v2.build_dataset_v2(root, prior)
            self.assertFalse((root / "dataset-v2").exists())
