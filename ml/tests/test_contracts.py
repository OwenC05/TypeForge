"""Regression contracts for the published v1 pipeline, using synthetic inputs."""

import json
import math
import tempfile
import unittest
from pathlib import Path

import numpy as np

from ml import pipeline


class ParsingTests(unittest.TestCase):
    def test_tsv_accepts_bom_and_keeps_literal_quotes(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "events.tsv"
            path.write_bytes('\ufeffLETTER\tKEYCODE\r\n"\t222\r\n'.encode())
            self.assertEqual(list(pipeline.tsv(path)), [{"LETTER": '"', "KEYCODE": "222"}])
            path.write_text("a\tb\n1\t2\t3\n")
            with self.assertRaisesRegex(ValueError, "oversized TSV"):
                list(pipeline.tsv(path))

    def test_shift_is_ignored_and_mismatched_copy_is_excluded(self) -> None:
        rows = [
            {"LETTER": "a", "KEYCODE": "65", "PRESS_TIME": "1"},
            {"LETTER": "SHIFT", "KEYCODE": "16", "PRESS_TIME": "2"},
            {"LETTER": "b", "KEYCODE": "66", "PRESS_TIME": "5001"},
        ]
        self.assertEqual([row["ms"] for row in pipeline.observations("ab", rows)], [5000])
        self.assertEqual(pipeline.observations("ac", rows), [])
        self.assertEqual(pipeline.occurrences("xéab_Zz"), [(3, "ab", 2, 1.0)])


class DesignTests(unittest.TestCase):
    def test_seed_42_has_known_partition_boundaries(self) -> None:
        expected = dict.fromkeys("cbdaifh", "train")
        expected.update(e="validation", g="test", j="test")
        self.assertEqual(pipeline.partition_participants("abcdefghij", 42), expected)
        self.assertNotEqual(pipeline.partition_participants("abcdefghij", 41), expected)

    def test_dense_history_separates_pair_and_user_fallbacks(self) -> None:
        history = [[{"pair": "aa", "log": 2}, {"pair": "ab", "log": 6}]]
        known = pipeline.features("aab", 1, history, 99)
        unseen = pipeline.features("zza", 1, history, 99)
        self.assertEqual(sum(known[:-6]), 1)
        self.assertEqual(known[0], 1)
        self.assertEqual(unseen[675], 1)
        self.assertEqual(known[-6:], [3, 0.5, 4, math.log1p(2), 2, math.log1p(1)])
        self.assertEqual(unseen[-6:], [3, 0.5, 4, math.log1p(2), 4, 0])

    def test_smoothed_pair_wins_on_held_out_synthetic_values(self) -> None:
        info = [{"pid": "a", "user": 4.0, "pairCount": 1, "pairSum": 6.0}]
        labels = np.array([5.0])
        choices = [("population", 0), ("user", 0), ("smoothed-pair", 1), ("smoothed-pair", 5)]
        scores = [
            pipeline.score(labels, pipeline.baseline(info, 3.0, kind, k), info)
            for kind, k in choices
        ]
        self.assertEqual(choices[scores.index(min(scores))], ("smoothed-pair", 1))


class ExportTests(unittest.TestCase):
    def test_public_json_keys_and_feature_order(self) -> None:
        model = json.loads((pipeline.GENERATED / "model.json").read_text())
        benchmark = json.loads((pipeline.GENERATED / "benchmark.json").read_text())
        self.assertEqual(set(model), {
            "artifactVersion", "baseline", "coefficients", "featureNames", "featureVersion",
            "intercept", "modelVersion", "populationMeanLogMs", "provenance",
            "residualLogQuantiles", "status", "task",
        })
        self.assertEqual(set(benchmark), {
            "audit", "environment", "evaluation", "hashes", "limitations", "modelVersion",
            "reportVersion", "reproduction", "selectedAlpha", "selectedBaseline", "source",
            "splitDesign", "stageTimingsSeconds", "status", "validationBaselines",
            "validationModels",
        })
        self.assertEqual(model["featureNames"][:2], ["pair_aa", "pair_ab"])
        self.assertEqual(model["featureNames"][675:], [
            "pair_zz", "word_length", "pair_position", "user_mean_log_ms", "user_log_count",
            "pair_mean_log_ms", "pair_log_count",
        ])
