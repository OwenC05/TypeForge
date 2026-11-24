"""Synthetic regression checks for archival fidelity and both test locks."""

import hashlib
import json
import math
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

import numpy as np

from ml.full_archive import ingest as a
from ml.pipeline import observations, partition_participants


def source_rows(rows, header=a.COLUMNS):
    return ("\t".join(header) + "\r\n" + "\r\n".join("\t".join(row) for row in rows) + "\r\n").encode()


def strokes(pid, target="cat", typed=None):
    return [[pid, "section", target, target, str(i), str(i * 100), str(i * 100 + 30),
             letter, str(ord(letter.upper()))] for i, letter in enumerate(typed or target)]


class IngestTests(unittest.TestCase):
    def test_v1_counts_and_first_reason(self):
        rows = strokes("synthetic", "aBcd can't go")
        original = [dict(zip(a.COLUMNS, row)) for row in rows]
        reference = observations(rows[0][2], original)
        # Source might be out of order, and the release value is irrelevant to v1.
        rows.reverse()
        rows[0][6] = "unknown"
        trial = a.parse_participant(source_rows(rows), "synthetic")["section"]
        self.assertTrue(math.isnan(trial.strokes[0][2]))
        self.assertEqual(a.eligibility(trial), ("eligible_trial", len(reference)))
        self.assertEqual(len(reference), 4)
        for change, result in (
            ({3: "different", 5: "nan"}, "nonfinite_time"),
            ({3: "different", 7: "Backspace"}, "not_exact_final_copy"),
            ({7: "Backspace"}, "unreconstructable_edit_or_control"),
            ({7: "x"}, "not_first_pass_reconstructable"),
            ({5: "0"}, "nonincreasing_press_time"),
        ):
            clean = strokes("synthetic")
            for index, value in change.items():
                clean[1][index] = value
            with self.subTest(result=result):
                trial = a.parse_participant(source_rows(clean), "synthetic")["section"]
                self.assertEqual(a.eligibility(trial), (result, 0))
        for gap, result in ((5000, ("eligible_trial", 1)), (5001, ("no_eligible_pairs", 0))):
            rows = strokes("synthetic", "ab")
            rows[1][5] = str(gap)
            rows.insert(1, ["synthetic", "section", "ab", "ab", "9", "0", "30", "SHIFT", "16"])
            self.assertEqual(a.eligibility(a.parse_participant(source_rows(rows), "synthetic")["section"]), result)

    def test_participant_atomicity_and_tsv_rules(self):
        rows = strokes("synthetic")
        rows[0][5] = "invalid number"
        with self.assertRaisesRegex(a.BadMember, "invalid_numeric_participant"):
            a.parse_participant(source_rows(rows), "synthetic")
        with self.assertRaisesRegex(a.BadMember, "malformed_tsv_participant"):
            a.parse_participant(source_rows(rows) + b"short\n", "synthetic")
        with self.assertRaisesRegex(a.BadMember, "invalid_utf8_participant"):
            a.parse_participant(source_rows(rows) + b"\xff", "synthetic")
        rows = strokes("synthetic")
        reversed_columns = source_rows([r[::-1] for r in rows], a.COLUMNS[::-1])
        trial = a.parse_participant(b"\xef\xbb\xbf" + reversed_columns + b"\n", "synthetic")["section"]
        self.assertEqual(a.eligibility(trial), ("eligible_trial", 2))
        with self.assertRaisesRegex(ValueError, "member mismatch"):
            a.parse_participant(source_rows(rows), "other")
        self.assertEqual(a.physical_rows(b"header\rrow\r\nrow\nrow"), 3)

    def test_split_membership_and_both_locks(self):
        ids = {str(10**11 + i) for i in range(121)}
        prior = set(sorted(ids)[:20])
        split = a.split_ids(ids, prior, 42)
        self.assertEqual({s: len(v) for s, v in split.items()},
                         {"test": 10, "validation": 10, "train": 98, "legacy_test": 3})
        self.assertEqual(set(split["legacy_test"]),
                         {pid for pid, label in partition_participants(prior).items() if label == "test"})
        ranked = sorted(ids - prior, key=lambda p: hashlib.sha256(("fresh-2026-11:split:" + p).encode()).digest())
        self.assertEqual(set(split["test"]), set(ranked[:10]))
        self.assertEqual(set(split["validation"]), set(ranked[10:20]))
        self.assertEqual(sorted(pid for people in split.values() for pid in people), sorted(ids))
        with self.assertRaisesRegex(ValueError, "missing"):
            a.split_ids(ids, prior | {"absent"}, 42)

    def test_end_to_end_fidelity_integrity_and_no_test_statistics(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            ids = [str(10**11 + i) for i in range(25)]
            prior = set(ids[:5])
            split = a.split_ids(set(ids), prior, 42)
            locked = set(split["test"] + split["legacy_test"])
            damaged, unsupported = split["train"][:2]
            meta_header = ["PARTICIPANT_ID", "LAYOUT", "KEYBOARD_TYPE", "AVG_WPM_15"]
            meta = source_rows([[p, "azerty" if p == unsupported else "qwerty", "full",
                                 "999" if p in locked else "110"] for p in ids], meta_header)
            self.assertTrue(all(a.read_metadata(meta, set(ids) - locked)[p][2] is None for p in locked))
            expected = []
            zip_path = base / "fixture.zip"
            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_STORED) as z:
                z.writestr(a.PREFIX + "metadata_participants.txt", meta)
                z.writestr("extra.bin", b"CRC-CHECK-THIS-CONTENT")
                for pid in ids:
                    name = a.PREFIX + pid + "_keystrokes.txt"
                    target = "locked" if pid in locked else "cat"
                    raw = source_rows(strokes(pid, target))
                    if pid == damaged:
                        raw += b"truncated\n"
                    z.writestr(name, raw)
                    if pid in prior:
                        info = z.getinfo(name)
                        expected.append(dict(name=name, sha256=hashlib.sha256(raw).hexdigest(),
                                             bytes=len(raw), crc32=info.CRC))
            subset_path = base / "prior.json"
            a.write_json(subset_path, dict(requestedParticipants=len(prior), seed=42, members=expected))
            output = base / "dataset"
            original = a.eligibility

            def guarded(trial):
                self.assertNotEqual(trial.target, "locked")
                return original(trial)

            with patch.object(a, "eligibility", guarded):
                a.ingest(zip_path, subset_path, output)
                a.ingest(zip_path, subset_path, base / "rebuilt")
            self.assertEqual(a.sha_file(output / "manifest.json"), a.sha_file(base / "rebuilt/manifest.json"))
            inventory = json.loads((output / "inventory.json").read_bytes())
            self.assertEqual(inventory["membersCrcVerified"], len(ids) + 2)
            stats = inventory["splits"]
            self.assertEqual(stats["train"]["v1"]["malformed_tsv_participant"], 1)
            self.assertEqual(stats["train"]["v1"]["unsupported_layout_or_keyboard"], 1)
            self.assertEqual(stats["train"]["wpm"]["atLeast"]["150"], 0)
            for label in ("test", "legacy_test"):
                self.assertNotIn("wpm", stats[label])
                self.assertNotIn("v1", stats[label])
            manifest = json.loads((output / "manifest.json").read_bytes())
            for entry in manifest["shards"]:
                path = output / entry["path"]
                self.assertEqual(a.sha_file(path), entry["sha256"])
                with np.load(path, allow_pickle=False) as shard:
                    trials = json.loads(shard["trials_json"].tobytes())
                    letters = json.loads(shard["letters_json"].tobytes())
                    flags = shard["is_press"]
                    self.assertEqual(len(flags), 2 * entry["keystrokes"])
                    self.assertTrue(flags[::2].all() and not flags[1::2].any())
                    np.testing.assert_array_equal(shard["timestamp_ms"][1::2] - shard["timestamp_ms"][::2], 30)
                    people = (path.parent / "ids.txt").read_text().splitlines()
                    for i, trial in enumerate(trials):
                        p, _, target, final, _, _, consistent = trial
                        self.assertNotEqual(people[p], damaged)
                        selected = (shard["trial_index"] == i) & flags
                        self.assertTrue((shard["participant_index"][selected] == p).all())
                        self.assertEqual("".join(letters[j] for j in shard["letter_index"][selected]), target)
                        self.assertEqual(final, target)
                        self.assertTrue(consistent)
            corrupt = zip_path.read_bytes().replace(b"CRC-CHECK-THIS-CONTENT", b"CRC-CHECK-THIS-CONTENX")
            zip_path.write_bytes(corrupt)
            with self.assertRaises(zipfile.BadZipFile):
                a.ingest(zip_path, subset_path, base / "bad-output")
            self.assertFalse((base / "bad-output").exists())


if __name__ == "__main__":
    unittest.main()
