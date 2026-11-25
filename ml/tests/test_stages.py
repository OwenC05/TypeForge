"""Offline stage boundaries with a tiny local ZIP and a synthetic validation matrix."""

import io
import os
import tempfile
import unittest
import zipfile
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

import numpy as np
from scipy.sparse import csr_matrix

from ml.acquire import acquire
from ml.archive import RangeZip
from ml.baselines import select_baseline
from ml.cli import main
from ml.config import DEFAULT_DATA_DIR, data_directory, digest, read_json, write_json
from ml.evaluate import evaluate
from ml.export import export
from ml.features import DesignMatrix, ObservationInfo
from ml.parity import parity_inputs
from ml.parse import Event, occurrences, trial_observations


class AcquisitionTests(unittest.TestCase):
    def test_cached_selection_and_crc_repair_use_only_local_source(self) -> None:
        with tempfile.TemporaryDirectory() as folder, redirect_stdout(io.StringIO()):
            root = Path(folder)
            source = root / "source.zip"
            names = [f"Keystrokes/files/{i}_keystrokes.txt" for i in range(5)]
            with zipfile.ZipFile(source, "w", zipfile.ZIP_DEFLATED) as archive:
                for name in [
                    "Keystrokes/files/readme.txt",
                    "Keystrokes/files/metadata_participants.txt",
                    *reversed(names),
                ]:
                    archive.writestr(name, "original")
            data_dir = root / "nested" / "data"
            acquire(data_dir, participants=2, source=str(source))
            manifest = (data_dir / "manifest.json").read_bytes()
            selected = [row["name"] for row in read_json(data_dir / "manifest.json")["members"][2:]]
            self.assertEqual(selected, sorted(names, key=lambda n: digest(f"42:{n}".encode()))[:2])
            with patch.object(RangeZip, "member", side_effect=AssertionError("cache miss")):
                acquire(data_dir, participants=2, source=str(source))
            self.assertEqual((data_dir / "manifest.json").read_bytes(), manifest)
            broken = data_dir / "raw" / Path(selected[0]).name
            broken.write_bytes(b"tampered")  # same size, different CRC
            acquire(data_dir, participants=2, source=str(source))
            self.assertEqual(broken.read_bytes(), b"original")
            self.assertEqual((data_dir / "manifest.json").read_bytes(), manifest)


class EligibilityTests(unittest.TestCase):
    def test_first_exclusion_and_press_order(self) -> None:
        def event(letter: str, time: str, final: str = "ab") -> Event:
            return {
                "LETTER": letter,
                "KEYCODE": "65",
                "PRESS_TIME": time,
                "USER_INPUT": final,
                "SENTENCE": "ab",
            }

        for second, expected in [
            (event("b", "nan", "ac"), "nonfinite_time"),
            (event("b", "501", "ac"), "not_exact_final_copy"),
            (event("Backspace", "501"), "unreconstructable_edit_or_control"),
            (event("c", "501"), "not_first_pass_reconstructable"),
            (event("b", "1"), "nonincreasing_press_time"),
            (event("b", "5002"), "no_eligible_pairs"),
        ]:
            with self.subTest(reason=expected):
                self.assertEqual(
                    trial_observations("ab", [event("a", "1"), second]), (expected, [])
                )


class SelectionTests(unittest.TestCase):
    def test_first_minimum_wins_and_smoothing_candidates_keep_order(self) -> None:
        info: ObservationInfo = {
            "pid": "a",
            "key": "a:1:1",
            "pair": "ab",
            "reserved": False,
            "warm": True,
            "count": 1,
            "pairCount": 1,
            "pairSum": 5.0,
            "user": 5.0,
            "prompt": "ab",
            "speedBand": "unknown",
        }
        validation = DesignMatrix(csr_matrix((1, 682)), np.array([5.0]), [info])
        chosen, candidates = select_baseline(validation, 5.0)
        self.assertEqual(
            [(c["kind"], c["k"]) for c in candidates],
            [
                ("population", 0),
                ("user", 0),
                ("smoothed-pair", 1),
                ("smoothed-pair", 5),
                ("smoothed-pair", 20),
            ],
        )
        self.assertEqual(chosen, {"kind": "population", "k": 0, "maeMs": 0.0})
        info.update(user=4.0, pairSum=6.0)
        chosen, _ = select_baseline(validation, 3.0)
        self.assertEqual(chosen, {"kind": "smoothed-pair", "k": 1, "maeMs": 0.0})


class DirectoryTests(unittest.TestCase):
    def test_cli_directory_precedence_and_timing_destinations(self) -> None:
        with tempfile.TemporaryDirectory() as folder, redirect_stdout(io.StringIO()):
            root = Path(folder)
            with patch.dict(os.environ, {}, clear=True):
                self.assertEqual(data_directory(), DEFAULT_DATA_DIR)
            with (
                patch.dict(os.environ, {"TYPEFORGE_DATA_DIR": str(root / "env")}),
                patch("ml.cli.audit") as audit,
            ):
                for args, target in [
                    (["audit"], "env"),
                    (["--data-dir", str(root / "before"), "audit"], "before"),
                    (["audit", "--data-dir", str(root / "after")], "after"),
                ]:
                    main(args)
                    audit.assert_called_with(root / target)
                    self.assertEqual(set(read_json(root / target / "timings.json")), {"audit"})

    def test_mismatched_registration_fails_before_test_features(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            write_json(root / "manifest.json", {})
            write_json(root / "rows.json", [])
            write_json(
                root / "config.json", {"rowsSha256": digest([]), "manifestSha256": digest({})}
            )
            write_json(root / "registration.json", {"configSha256": "different"})
            with (
                patch("ml.evaluate.matrix", side_effect=AssertionError("test was opened")),
                self.assertRaisesRegex(ValueError, "holdout remains locked"),
            ):
                evaluate(root, root / "registration.json")
            self.assertFalse((root / "evaluation.json").exists())


class ExportTests(unittest.TestCase):
    def test_export_writes_linked_public_outputs_from_frozen_inputs(self) -> None:
        prediction_count = sum(len(occurrences(prompt)) for prompt, _ in parity_inputs())
        model = {
            "alpha": 1,
            "intercept": 0.0,
            "coefficients": [0.0] * 682,
            "parityPredictions": [0.0] * prediction_count,
        }
        config = {
            "models": {"ridge": model},
            "baseline": {"kind": "population", "k": 0},
            "populationMeanLogMs": 0.0,
            "residualLogQuantiles": {"q10": -1, "q90": 1},
            "manifestSha256": digest({}),
            "rowsSha256": digest([]),
            "participantSplit": "fixture",
            "reservedPrompts": "fixture",
            "primary": "fixture",
            "secondary": [],
            "bootstrap": {},
            "validationBaselines": [],
            "validationModels": [],
            "environment": {},
        }
        with tempfile.TemporaryDirectory() as folder, redirect_stdout(io.StringIO()):
            root = Path(folder)
            inputs = root / "inputs"
            generated = root / "generated"
            fixture = root / "fixtures" / "parity.json"
            write_json(inputs / "manifest.json", {})
            write_json(inputs / "config.json", config)
            write_json(inputs / "evaluation.json", {"configSha256": digest(config)})
            audit = {"acquiredParticipants": 12, "rowsSha256": digest([])}
            write_json(inputs / "audit.json", audit)
            with self.assertRaisesRegex(ValueError, "exactly 2000"):
                export(inputs, generated_dir=generated, parity_path=fixture)
            self.assertFalse(generated.exists())
            audit["acquiredParticipants"] = 2000
            write_json(inputs / "audit.json", audit)
            export(inputs, generated_dir=generated, parity_path=fixture)
            artifact = read_json(generated / "model.json")
            benchmark = read_json(generated / "benchmark.json")
            parity = read_json(fixture)
            self.assertEqual(
                {p.name for p in generated.iterdir()}, {"model.json", "benchmark.json"}
            )
            self.assertEqual(artifact["provenance"]["reportVersion"], benchmark["reportVersion"])
            self.assertEqual(benchmark["hashes"]["artifactSha256"], digest(artifact))
            self.assertEqual(parity["modelVersion"], artifact["modelVersion"])
            self.assertEqual(len(parity["cases"]), 2)
            self.assertEqual(benchmark["stageTimingsSeconds"], {})
