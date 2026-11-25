"""Test the browser export. Run as a module with train.npz to regenerate coach-parity.json."""

import argparse
import json
import math
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

from ml.coach import browser_table as browser
from ml.coach.b6 import PINS
from ml.coach.model import COACH_Z, GAP, MIN_COUNT, PAIRS, RANGE_Z, suggestion, update
from ml.coach.validation import coach_inputs, file_hash, fit_training
from ml.features import PAIR_NAMES

FIXTURE = browser.ROOT / "ml/fixtures/coach-parity.json"
INDEX = {name.removeprefix("pair_"): i for i, name in enumerate(PAIR_NAMES)}


def histories(model):
    center = model.speed.center
    background = {"he": 8, "in": 8, "er": 8}

    def sentence(level, counts, gaps=None):
        gaps = gaps or {}
        return {"pairs": {
            pair: {"count": n, "logSum": n * (model.speed.a[INDEX[pair]] + (level - center)
                                             + gaps.get(pair, 0))}
            for pair, n in counts.items()
        }}

    base = sentence(center, background)
    yield "empty", []
    yield "clean-no-intervals", [{"pairs": {}}]
    yield "one-sentence", [sentence(center, {"th": 1, "hi": 1, "in": 1})]
    # 12,000 / WPM is a synthetic inter-key pace in ms; source WPM is never a model input.
    for wpm in (40, 80, 120, 190, 20):
        yield f"pace-{wpm}-wpm", [sentence(math.log(12_000 / wpm), background)]
    yield "fast-boundary", [sentence(model.speed.low, background)]
    yield "slow-boundary", [sentence(model.speed.high, background)]
    for name, pair, count, excess in (
        ("weak-bank-pair", "st", 8, 1.7), ("weak-outside-bank", "zz", 8, 1.7),
        ("one-observation", "st", 1, 2.8), ("minimum-count", "st", 2, 2.4),
        ("small-gap", "st", 8, 0.10),
    ):
        yield name, [base, sentence(center, {pair: count}, {pair: excess})]
    one = sentence(center, {"st": 1}, {"st": 2.4})
    yield "split-across-sentences", [one, base, one]
    yield "two-actionable", [base, sentence(center, {"th": 6, "st": 6}, {"th": 1.25, "st": 1.6})]
    fast = math.log(12_000 / 190)
    yield "fast-weak-pair", [sentence(fast, background), sentence(fast, {"in": 8}, {"in": 2.0})]
    yield "one-pair-history", [sentence(center, {"aa": 40}, {"aa": -0.5})]
    # Solve the score equation for an and at at center, and balance the level with th.
    # These binary64 log sums yield equal, finite scores in NumPy and the browser port.
    yield "exact-ranking-tie", [{"pairs": {
        "at": {"count": 4, "logSum": 28.273076074564507},
        "an": {"count": 4, "logSum": 32.27450330652622},
        "th": {"count": 32, "logSum": 127.01680754359505},
    }}]


def write_parity(train):
    model, table = browser.fitted_table(train)
    frequency = np.array(table["frequency"])
    cases = []
    for i, (name, sentences) in enumerate(histories(model)):
        n, total = np.zeros(PAIRS), np.zeros(PAIRS)
        for sentence in sentences:
            for pair, stats in sentence["pairs"].items():
                n[INDEX[pair]] += stats["count"]
                total[INDEX[pair]] += stats["logSum"]
        state = update(model, n, total)
        choice = suggestion(state, model, n, frequency)
        if name == "exact-ranking-tie":
            p = np.array([INDEX["an"], INDEX["at"]])
            scores = frequency[p] * np.exp(state.expected[p] + model.sigma2[p] / 2) * np.expm1(state.gap[p])
            assert (state.gap[p] - COACH_Z * np.sqrt(state.variance[p]) > GAP).all()
            assert scores[0] == scores[1] and choice == p[0]
        m = (1, 2, 5, 16)[i % 4]
        radius = RANGE_Z * np.sqrt(state.variance + model.sigma2 / m)
        # Keep the fixture small. Store every observed pair plus the alphabet endpoints.
        pairs = {}
        for pair, p in INDEX.items():
            if n[p] or pair in ("aa", "zz"):
                pairs[pair] = {
                    "expected": state.expected[p], "gap": state.gap[p], "variance": state.variance[p],
                    "range": [state.prediction[p] - radius[p], state.prediction[p] + radius[p]],
                }
        cases.append({
            "name": name, "sentences": sentences, "speed": state.speed, "ownMean": state.own_mean,
            "suggestion": None if choice is None else PAIR_NAMES[choice][5:], "laterCount": m, "pairs": pairs,
        })
    fixture = {"modelSha256": table["modelSha256"], "cases": cases}
    FIXTURE.write_text(json.dumps(fixture, allow_nan=False, indent=2) + "\n", encoding="utf-8", newline="\n")


class BrowserTableTests(unittest.TestCase):
    def test_synthetic_export_round_trips_the_float64_fit_and_repeats_byte_for_byte(self):
        with tempfile.TemporaryDirectory() as tmp:
            train, output = Path(tmp) / "train.npz", Path(tmp) / "table.json"
            who = np.repeat(np.arange(3), 24)
            pair = np.tile([0, PAIRS - 1], len(who) // 2)
            np.savez(train, typist_avg_wpm_15=[40, 80, 120], typist_trials_eligible=[2, 2, 2],
                     interval_typist=who, interval_pair=pair, interval_log_ms=5.3 - 0.16 * who + 0.01 * (pair == 0))
            model, _, stats = fit_training(train)
            with patch.dict(PINS, {"train.npz": file_hash(train), "fitted_model": stats["model_sha256"]}):
                browser.export(train, output)
                first = output.read_bytes()
                browser.export(train, output)
                self.assertEqual(first, output.read_bytes())
            table = json.loads(first)
            self.assertEqual(table["modelSha256"], stats["model_sha256"])
            self.assertEqual(table["trainSha256"], file_hash(train))
            self.assertEqual(table["pairFrequenciesSha256"], PINS["pair_frequencies.json_LF"])
            self.assertEqual([table[k] for k in ("center", "low", "high")], stats["center_low_high_log_ms"])
            for key, values in (("a", model.speed.a), ("b", model.speed.b), ("tau2", model.tau2),
                                ("sigma2", model.sigma2), ("frequency", coach_inputs()[1])):
                np.testing.assert_array_equal(table[key], values)
            self.assertEqual([table[k] for k in ("version", "MIN_COUNT", "GAP", "COACH_Z", "RANGE_Z")],
                             [1, MIN_COUNT, GAP, COACH_Z, RANGE_Z])

    def test_wrong_input_or_fit_cannot_overwrite_the_destination(self):
        with tempfile.TemporaryDirectory() as tmp:
            train, output = Path(tmp) / "train.npz", Path(tmp) / "table.json"
            train.write_bytes(b"unknown training data")
            output.write_bytes(b"original")
            with patch.object(browser, "fit_training") as fit:
                with self.assertRaisesRegex(ValueError, "train.npz"):
                    browser.export(train, output)
                fit.assert_not_called()
                fit.return_value = (None, None, {"model_sha256": "different"})
                with patch.dict(PINS, {"train.npz": file_hash(train)}), self.assertRaisesRegex(ValueError, "fitted_model"):
                    browser.export(train, output)
            self.assertEqual(output.read_bytes(), b"original")

    def test_published_artifacts_identify_the_registered_inputs(self):
        table, fixture = (json.loads(path.read_bytes()) for path in (browser.TABLE, FIXTURE))
        self.assertEqual(table["modelSha256"], PINS["fitted_model"])
        self.assertEqual(fixture["modelSha256"], table["modelSha256"])
        self.assertEqual(table["trainSha256"], PINS["train.npz"])
        self.assertEqual(table["pairFrequenciesSha256"], PINS["pair_frequencies.json_LF"])
        np.testing.assert_array_equal(table["frequency"], coach_inputs()[1])
        self.assertEqual(np.count_nonzero(table["frequency"]), 100)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("train", type=Path, help="Registered B3 train.npz")
    write_parity(parser.parse_args().train)
