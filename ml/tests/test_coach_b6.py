"""Exercise the B6 driver on private, synthetic assignments, including the fresh branch."""

import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import numpy as np

from ml.coach import b6
from ml.coach.model import PAIRS, Model, Speed


class DriverTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.snapshot = self.root / "ingest-v1"
        roster = self.snapshot / "test/ids.txt"
        roster.parent.mkdir(parents=True)
        roster.write_bytes(b"a\nb\nc\nd\ne\nf\ng\n")
        self.metadata = self.root / "metadata_participants.txt"
        self.metadata.write_text("PARTICIPANT_ID\tAVG_WPM_15\n"
                                 "g\t121\nd\tbroken\na\t52.5\nf\t-inf\nc\t\ne\tNaN\n")
        mapping = {"test": {"participants": 7, "sha256": b6.file_hash(roster)}}
        split_manifest = self.snapshot / "split-manifest.json"
        split_manifest.write_text(json.dumps({"splits": mapping}))
        self.entries = [{"path": "test/two.npz"}, {"path": "test/one.npz"}]
        manifest = self.snapshot / "manifest.json"
        manifest.write_text(json.dumps({"splitManifestSha256": b6.file_hash(split_manifest),
                                        "shards": self.entries}))
        train = self.root / "dataset-v2/train.npz"
        train.parent.mkdir()
        train.write_bytes(b"synthetic train fixture")
        self.out = self.root / "out.json"
        self.receipt = self.root / "out.json.input.sha256"
        speed = Speed(5.0, 4.0, 6.0, np.full(PAIRS, 5.0), np.full(PAIRS, 5.0), np.ones(PAIRS))
        model = Model(speed, np.full(PAIRS, 0.04), np.full(PAIRS, 0.09))
        self.fit = self.enterContext(patch.object(b6, "fit_training",
                                     return_value=(model, model, {"model_sha256": "fixture-fit"})))
        self.builder = Mock(side_effect=self.build_clean)
        module = SimpleNamespace(__file__=__file__, _build_split=self.builder)
        self.enterContext(patch.object(b6, "import_module", return_value=module))
        self.enterContext(patch.dict(b6.PINS, {
            "test/ids.txt": b6.file_hash(roster), "manifest.json": b6.file_hash(manifest),
            "split-manifest.json": b6.file_hash(split_manifest),
            "metadata_participants.txt": b6.file_hash(self.metadata),
            "train.npz": b6.file_hash(train), "fitted_model": "fixture-fit",
            "builder_LF": b6.text_hash(Path(__file__)),
        }))

    def build_clean(self, pool, snapshot, entries, stage, split, wpm, historical):
        self.assertEqual((snapshot, entries, split, historical),
                         (self.snapshot, self.entries, "test", []))
        np.testing.assert_equal(wpm, [52.5, np.nan, np.nan, np.nan, np.nan, np.nan, 121])
        empty = np.array([], dtype=int)
        np.savez(stage / "test.npz", typist_avg_wpm_15=wpm, typist_index=np.arange(len(wpm)),
                 typist_trials_replayed=np.zeros(len(wpm), dtype=int), trial_typist=empty,
                 trial_order=empty, trial_reason=empty, reason_labels=np.array([""]),
                 trial_sentence=empty, sentences=np.array([], dtype=str), interval_typist=empty,
                 interval_trial_order=empty, interval_pair=empty, interval_log_ms=empty,
                 interval_position=empty)

    def test_fresh_forwarding_records_exact_input_before_one_clean_score(self):
        score = b6.score_split
        def observe(model, limited, ridge, frequency, data):
            self.assertFalse(data.allow_pickle)
            self.assertFalse(self.out.exists())
            checksum = b6.file_hash(Path(data.fid.name))
            self.assertEqual(self.receipt.read_text(), f"{checksum}  test.npz\n")
            return score(model, limited, ridge, frequency, data)

        with patch.object(b6, "score_split", side_effect=observe) as scorer:
            b6.run("fresh", self.root, self.metadata, self.out)
            scorer.assert_called_once()
        self.builder.assert_called_once()
        value = json.loads(self.out.read_bytes())
        self.assertEqual(value["bands"]["all"]["assigned"], 7)
        self.assertEqual(value["bands"]["40–<80"]["assigned"], 1)
        self.assertEqual(value["bands"]["120+"]["assigned"], 1)
        self.assertNotIn("mae_D2", value["bands"]["all"])
        self.assertEqual(value["clean_npz_sha256"], self.receipt.read_text().split()[0])
        first = self.out.read_bytes()
        with self.assertRaises(FileExistsError):
            b6.run("fresh", self.root, self.metadata, self.out)
        self.assertEqual(self.out.read_bytes(), first)
        self.fit.assert_called_once()

    def test_mismatched_inputs_stop_before_the_builder_and_scorer(self):
        for name in ("builder_LF", "manifest.json", "split-manifest.json",
                     "metadata_participants.txt",
                     "train.npz", "pair_frequencies.json_LF", "model.json_LF", "fitted_model",
                     "model.py_LF", "replay.py_LF", "validation.py_LF", "test/ids.txt"):
            with (self.subTest(name=name), patch.dict(b6.PINS, {name: "incorrect"}),
                  patch.object(b6, "score_split", side_effect=AssertionError("score called")),
                  self.assertRaisesRegex(ValueError, "SHA256 mismatch")):
                b6.run("fresh", self.root, self.metadata, self.out)
        self.builder.assert_not_called()
        self.assertFalse(self.receipt.exists() or self.out.exists())

    def test_concurrent_output_wins_without_overwrite_or_second_score(self):
        def simultaneous_writer(*args):
            self.out.write_bytes(b"existing result")
            return {}
        with (patch.object(b6, "score_split", side_effect=simultaneous_writer) as scorer,
              self.assertRaises(FileExistsError)):
            b6.run("fresh", self.root, self.metadata, self.out)
        scorer.assert_called_once()
        self.assertEqual(self.out.read_bytes(), b"existing result")
        self.assertTrue(self.receipt.is_file())

    def test_scoring_failure_keeps_only_the_prescore_receipt(self):
        with (patch.object(b6, "score_split", side_effect=RuntimeError("scoring error")),
              self.assertRaisesRegex(RuntimeError, "scoring error")):
            b6.run("fresh", self.root, self.metadata, self.out)
        self.assertFalse(self.out.exists())
        self.assertTrue(self.receipt.is_file())
        with self.assertRaises(FileExistsError):
            b6.run("fresh", self.root, self.metadata, self.out)

    def test_validation_comparison_checks_every_clean_metric_and_training(self):
        full = {"input_sha256": {}, "training": {"model_sha256": "pinned"},
                "bands": {"all": {"mae_L5": 0.2, "mae_D2": 0.1}}, "primary_decision": "pass"}
        clean = {"bands": {"all": {"mae_L5": 0.2}}, "primary_decision": "pass"}
        b6.check_validation(clean, full["training"], full)
        for scores, stats in (({**clean, "primary_decision": "fail_margin"}, full["training"]),
                              (clean, {}), ({**clean, "bands": {}}, full["training"])):
            with self.assertRaisesRegex(ValueError, "differs"):
                b6.check_validation(scores, stats, full)
