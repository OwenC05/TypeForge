"""Synthetic tests; never used in reported benchmark metrics."""

import io
import math
import unittest
import zipfile
from typing import Any

from ml.dataset import Trial
from ml.pipeline import (
    RangeZip,
    bootstrap,
    features,
    macro,
    observations,
    occurrences,
    reserved,
)
from ml.split import Split


class PipelineTests(unittest.TestCase):
    def test_boundaries(self) -> None:
        self.assertEqual(
            [(x[0], x[1]) for x in occurrences("aBcd can't go")],
            [(3, "cd"), (6, "ca"), (7, "an"), (12, "go")],
        )

    def test_intervals_do_not_bridge(self) -> None:
        rows = [
            {"PRESS_TIME": str(t), "LETTER": c, "KEYCODE": str(ord(c.upper()))}
            for c, t in zip("abcd", [1, 101, 101, 7000])
        ]
        self.assertEqual([x["pair"] for x in observations("abcd", rows)], ["ab"])

    def test_features_history_fallback(self) -> None:
        x = features("cat", 1, [], math.log(200))
        self.assertEqual(len(x), 682)
        self.assertEqual(x[52], 1)
        self.assertEqual(x[-6:], [3, 0.5, math.log(200), 0, math.log(200), 0])

    def test_split_and_prompt_determinism(self) -> None:
        self.assertEqual(reserved("Hello   WORLD"), reserved("hello world"))

    def test_macro_not_micro(self) -> None:
        self.assertEqual(macro({"a": [0, 0, 0], "b": [10]}), 5)
        self.assertIsNone(bootstrap({"a": [1]}, 42))
        self.assertEqual(bootstrap({"a": [1], "b": [1]}, 42), [1, 1])

    def test_local_zip_crc_and_missing(self) -> None:
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "sample.zip"
            with zipfile.ZipFile(p, "w", zipfile.ZIP_DEFLATED) as z:
                z.writestr("hello", "world")
            source = RangeZip(str(p), 100000)
            self.assertEqual(source.member("hello"), b"world")
            with self.assertRaises(KeyError):
                source.member("absent")
            with self.assertRaises(ValueError):
                RangeZip(str(p), 10)


class LeakageTests(unittest.TestCase):
    def records(self) -> list[Trial]:
        def row(trial: int, value: float, held: bool = False) -> Trial:
            return {
                "pid": "person",
                "trial": str(trial),
                "prompt": "cat",
                "split": "test",
                "reserved": held,
                "observations": [
                    {
                        "position": 1,
                        "pair": "ca",
                        "length": 3,
                        "relative": 0.5,
                        "ms": value,
                        "log": math.log(value),
                    }
                ],
            }

        return [row(1, 100), row(2, 900, True), row(3, 200)]

    def test_reserved_never_calibrates_and_future_cannot_change_past(self) -> None:
        from ml.pipeline import matrix

        rows = self.records()
        x, _, info = matrix(rows, math.log(150), "test", True)
        self.assertFalse(info[0]["warm"])
        self.assertTrue(info[1]["warm"])
        self.assertEqual(info[2]["count"], 1)
        self.assertEqual(info[2]["user"], math.log(100))
        rows[1]["observations"][0]["log"] = math.log(9999)
        rows[2]["observations"][0]["log"] = math.log(9999)
        changed, _, _ = matrix(rows, math.log(150), "test", True)
        self.assertEqual((x != changed).nnz, 0)
        self.assertEqual(len({r["key"] for r in info}), 3)
        _, _, seen = matrix(rows, math.log(150), "test")
        self.assertEqual(len(seen), 2)

    def test_history_ten_sentence_window(self) -> None:
        from ml.pipeline import summary_history

        history = [[{"pair": "ca", "log": float(i)}] for i in range(12)]
        count, total, _ = summary_history(history)
        self.assertEqual(count, 10)
        self.assertEqual(total, sum(range(2, 12)))

    def test_sparse_scaling_folds_without_intercept_subtraction(self) -> None:
        import numpy as np
        from scipy.sparse import csr_matrix
        from sklearn.linear_model import Ridge
        from sklearn.preprocessing import StandardScaler

        x = csr_matrix([[1.0, 10.0], [2.0, 30.0], [3.0, 20.0], [4.0, 50.0]])
        y = np.array([1.0, 2.0, 4.0, 8.0])
        scale = StandardScaler(with_mean=False).fit(x)
        estimator = Ridge(solver="lsqr").fit(scale.transform(x), y)
        expected = estimator.predict(scale.transform(x))
        actual = x @ (estimator.coef_ / scale.scale_) + estimator.intercept_
        np.testing.assert_allclose(actual, expected, rtol=1e-12)


class PartitionTests(unittest.TestCase):
    def test_exact_disjoint_acquisition_split_is_order_independent(self) -> None:
        from collections import Counter

        from ml.pipeline import partition_participants

        ids = [str(i) for i in range(2000)]
        result = partition_participants(ids)
        self.assertEqual(result, partition_participants(list(reversed(ids))))
        self.assertEqual(Counter(result.values()), {"train": 1400, "validation": 300, "test": 300})


class AcquisitionTests(unittest.TestCase):
    def source(self) -> RangeZip:
        import threading

        source = RangeZip.__new__(RangeZip)
        source.source = "https://example.invalid/archive.zip"
        source.cap = 100
        source.used = 0
        source.lock = threading.Lock()
        source.etag = "original"
        source.local = None
        source.size = 10
        return source

    def test_remote_range_and_etag_fail_closed(self) -> None:
        from unittest.mock import patch

        class Response(io.BytesIO):
            status = 206

            def __init__(
                self, data: bytes, content_range: str = "bytes 0-2/10", etag: str = "original"
            ) -> None:
                super().__init__(data)
                self.headers = {"Content-Range": content_range, "ETag": etag}

        with patch("ml.archive.urlopen_retry", return_value=Response(b"abc")):
            self.assertEqual(self.source().fetch(0, 3), b"abc")

        for response, error in [
            (Response(b"abc", content_range="bytes 0-9/10"), "range"),
            (Response(b"abc", etag="changed"), "ETag"),
            (Response(b"ab"), "Truncated"),
        ]:
            with (
                self.subTest(error=error),
                patch("ml.archive.urlopen_retry", return_value=response),
                self.assertRaisesRegex(ValueError, error),
            ):
                self.source().fetch(0, 3)

    def test_zip64_footer_and_crc(self) -> None:
        import struct
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "zip64.zip"
            with zipfile.ZipFile(p, "w", zipfile.ZIP_STORED) as z:
                z.writestr("hello", "world")
            raw = p.read_bytes()
            end = raw.rfind(b"PK\x05\x06")
            values = list(struct.unpack("<4s4H2LH", raw[end:]))
            directory_size, directory_offset = values[5:7]
            zip64 = struct.pack(
                "<4sQ2H2L4Q",
                b"PK\x06\x06",
                44,
                45,
                45,
                0,
                0,
                1,
                1,
                directory_size,
                directory_offset,
            )
            locator = struct.pack("<4sLQL", b"PK\x06\x07", 0, end, 1)
            values[5] = values[6] = 0xFFFFFFFF
            p.write_bytes(raw[:end] + zip64 + locator + struct.pack("<4s4H2LH", *values))
            self.assertEqual(RangeZip(str(p), 10000).member("hello"), b"world")
            altered = p.read_bytes().replace(b"world", b"worse")
            p.write_bytes(altered)
            with self.assertRaisesRegex(ValueError, "checksum"):
                RangeZip(str(p), 10000).member("hello")

    def test_truncated_tsv_rejected(self) -> None:
        import tempfile
        from pathlib import Path

        from ml.pipeline import tsv

        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "bad.tsv"
            p.write_text("a\tb\n1\n")
            with self.assertRaisesRegex(ValueError, "Truncated"):
                list(tsv(p))


class BoundaryTests(unittest.TestCase):
    def test_invalid_intervals_and_max_pause(self) -> None:
        for delta, expected in [(0, 0), (-1, 0), (5000, 1), (5001, 0), (float("nan"), 0)]:
            events = [
                {"LETTER": "a", "KEYCODE": "65", "PRESS_TIME": "0"},
                {"LETTER": "b", "KEYCODE": "66", "PRESS_TIME": str(delta)},
            ]
            self.assertEqual(len(observations("ab", events)), expected)

    def test_participants_do_not_share_history(self) -> None:
        from ml.pipeline import matrix

        rows = LeakageTests().records()
        rows[2]["pid"] = "other"
        _, _, info = matrix(rows, math.log(150), "test", True)
        self.assertEqual(info[2]["count"], 0)
        self.assertFalse(info[2]["warm"])

    def test_train_features_do_not_depend_on_test_labels(self) -> None:
        from ml.pipeline import matrix

        rows = LeakageTests().records()
        rows[0]["split"] = "train"
        x, y, info = matrix(rows, math.log(150), "train")
        rows[2]["observations"][0]["log"] = 1000
        xx, yy, ii = matrix(rows, math.log(150), "train")
        self.assertEqual((x != xx).nnz, 0)
        self.assertEqual(y.tolist(), yy.tolist())
        self.assertEqual(info, ii)


class ShippedArtifactTests(unittest.TestCase):
    def test_actual_export_matches_fitted_estimator_fixtures(self) -> None:
        import json

        from ml.pipeline import GENERATED, NAMES, ROOT, digest

        model = json.loads((GENERATED / "model.json").read_text())
        report = json.loads((GENERATED / "benchmark.json").read_text())
        fixture = json.loads((ROOT / "fixtures/parity.json").read_text())
        self.assertEqual(model["featureNames"], NAMES)
        self.assertEqual(len(model["coefficients"]), 682)
        self.assertEqual(model["status"], "experimental")
        self.assertEqual(model["modelVersion"], fixture["modelVersion"])
        self.assertEqual(model["modelVersion"], report["modelVersion"])
        self.assertEqual(model["provenance"]["reportVersion"], report["reportVersion"])
        self.assertEqual(digest(model), report["hashes"]["artifactSha256"])
        for case in fixture["cases"]:
            for occurrence in case["occurrences"]:
                prediction = model["intercept"] + sum(
                    a * b for a, b in zip(occurrence["features"], model["coefficients"])
                )
                self.assertTrue(
                    math.isclose(prediction, occurrence["predictedLogMs"], rel_tol=1e-12)
                )
                self.assertTrue(
                    math.isclose(math.exp(prediction), occurrence["predictedMs"], rel_tol=1e-12)
                )

    def test_report_records_reserved_holdout_and_no_promotion(self) -> None:
        import json

        from ml.pipeline import GENERATED

        report = json.loads((GENERATED / "benchmark.json").read_text())
        self.assertEqual(report["audit"]["acquiredParticipants"], 2000)
        slices = report["evaluation"]["slices"]
        self.assertEqual(
            set(slices), {"primary", "nonreserved-cold", "reserved-warm", "reserved-cold"}
        )
        for key in ["reserved-warm", "reserved-cold"]:
            self.assertEqual(slices[key]["actualTrainPromptOverlapFraction"], 0)
        self.assertIn("no TypeForge", report["evaluation"]["promotion"])
        self.assertEqual(report["status"], "experimental")


class ExperimentBoundaryTests(unittest.TestCase):
    """Exercise actual fit/evaluation on isolated synthetic inputs, never source data."""

    @staticmethod
    def trial(
        pid: str, label: str | int, value: float = 100, held: bool = False, split: Split = "test"
    ) -> Trial:
        return {
            "pid": pid,
            "trial": str(label),
            "prompt": "cat",
            "reserved": held,
            "split": split,
            "observations": [
                {
                    "position": 1,
                    "pair": "ca",
                    "length": 3,
                    "relative": 0.5,
                    "ms": value,
                    "log": math.log(value),
                }
            ],
        }

    def evaluate_fixture(self, rows: list[Trial]) -> tuple[dict[str, Any], dict[str, list[str]]]:
        import tempfile
        from contextlib import redirect_stdout
        from pathlib import Path

        from ml import pipeline
        from ml.config import read_json, write_json
        from ml.evaluate import evaluate

        manifest = {"seed": 42}
        model = {"coefficients": [0.0] * 682, "intercept": math.log(100)}
        config = {
            "rowsSha256": pipeline.digest(rows),
            "manifestSha256": pipeline.digest(manifest),
            "populationMeanLogMs": math.log(100),
            "validationBaselines": [{"kind": "smoothed-pair", "k": 1, "maeMs": 1}],
            "baseline": {"kind": "smoothed-pair", "k": 1},
            "models": {"ridge": model, "ridge-no-history": model},
            "residualLogQuantiles": {"q10": -1, "q90": 1},
            "bootstrap": {"seed": 42},
        }
        inputs = {"config.json": config, "rows.json": rows, "manifest.json": manifest}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data_dir = root / "data"
            registration = root / "experiment.json"
            write_json(registration, {"configSha256": pipeline.digest(config)})
            for name, value in inputs.items():
                write_json(data_dir / name, value)
            with redirect_stdout(io.StringIO()):
                evaluate(data_dir, registration)
            return read_json(data_dir / "evaluation.json"), read_json(
                data_dir / "evaluation-keys.json"
            )

    def test_evaluate_exact_disjoint_slices_and_one_participant_interval(self) -> None:
        rows = [
            self.trial("train", 1, split="train"),
            self.trial("a", 1),
            self.trial("a", 2, held=True),
            self.trial("a", 3, value=120),
            self.trial("b", 1, held=True),
        ]
        report, keys = self.evaluate_fixture(rows)
        self.assertEqual(
            keys,
            {
                "primary": ["a:3:1"],
                "nonreserved-cold": ["a:1:1"],
                "reserved-warm": ["a:2:1"],
                "reserved-cold": ["b:1:1"],
            },
        )
        observations = [key for values in keys.values() for key in values]
        self.assertEqual(len(observations), len(set(observations)))
        for name, section in report["slices"].items():
            self.assertEqual(section["status"], "available", name)
            self.assertEqual(section["observations"], 1, name)
        primary = report["slices"]["primary"]
        self.assertEqual(primary["participants"], 1)
        self.assertIsNotNone(primary["metrics"])
        self.assertIsNotNone(primary["differenceMs"])
        self.assertIsNone(primary["differenceCi95Ms"])

    def test_evaluate_absent_primary_is_unavailable_not_secondary_substitution(self) -> None:
        report, keys = self.evaluate_fixture([self.trial("b", 1, held=True)])
        primary = report["slices"]["primary"]
        self.assertEqual(primary["status"], "unavailable")
        self.assertEqual(primary["participants"], 0)
        self.assertEqual(primary["observations"], 0)
        self.assertIsNone(primary["metrics"])
        self.assertIsNone(primary["differenceCi95Ms"])
        self.assertEqual(keys["primary"], [])
        self.assertEqual(keys["reserved-cold"], ["b:1:1"])
        self.assertEqual(report["slices"]["reserved-cold"]["status"], "available")

    def test_train_fit_and_selection_ignore_future_heldout_and_reserved_labels(self) -> None:
        import tempfile
        from contextlib import redirect_stdout
        from pathlib import Path

        from ml.config import read_json, write_json
        from ml.train import train

        rows = [
            self.trial(pid, i, value=base + i * 5, split=split)
            for pid, split, base in [
                ("t1", "train", 100),
                ("t2", "train", 200),
                ("v1", "validation", 130),
                ("v2", "validation", 230),
                ("z1", "test", 400),
            ]
            for i in range(4)
        ]
        # A reserved trial inside a train participant's chronology must never calibrate.
        rows.insert(2, self.trial("t1", "reserved", value=9999, held=True, split="train"))
        expected_population = (
            sum(
                row["observations"][0]["log"]
                for row in rows
                if row["split"] == "train" and not row["reserved"]
            )
            / 8
        )
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data_dir = root / "data"
            with redirect_stdout(io.StringIO()):
                write_json(data_dir / "manifest.json", {"seed": 42})
                write_json(data_dir / "rows.json", rows)
                train(data_dir, root / "experiment.json")
                first = read_json(data_dir / "config.json")
                self.assertAlmostEqual(first["populationMeanLogMs"], expected_population)
                self.assertTrue(any(first["models"]["ridge"]["coefficients"]))

                for row in rows:
                    if row["split"] == "test" or row["reserved"]:
                        row["observations"][0].update(ms=5000, log=math.log(5000))
                write_json(data_dir / "rows.json", rows)
                train(data_dir, root / "experiment.json")
                second = read_json(data_dir / "config.json")
                self.assertNotEqual(first["rowsSha256"], second["rowsSha256"])
                for field in [
                    "models",
                    "populationMeanLogMs",
                    "baseline",
                    "validationBaselines",
                    "validationModels",
                    "residualLogQuantiles",
                ]:
                    self.assertEqual(first[field], second[field], field)
                self.assertFalse((data_dir / "evaluation.json").exists())


if __name__ == "__main__":
    unittest.main()
