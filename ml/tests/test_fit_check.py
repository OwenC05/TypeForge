"""Test the fit check. Run as a module with train.npz to regenerate the browser fixture."""

import argparse
import json
import unittest
from pathlib import Path

import numpy as np

from ml.coach.b6 import PINS
from ml.coach.browser_table import TABLE
from ml.coach.fit_check import registered_fit, sentence_checks, summarize
from ml.coach.model import PAIRS, RANGE_Z, Model, Speed
from ml.coach.validation import ROOT
from ml.features import PAIR_NAMES

FIXTURE = ROOT / "ml/fixtures/fit-check-parity.json"


def sentence(**pairs):
    return {pair: {"count": n, "logSum": total} for pair, (n, total) in pairs.items()}


def pair_arrays(sentence):
    counts, sums = np.zeros(PAIRS, dtype=int), np.zeros(PAIRS)
    for pair, values in sentence.items():
        p = PAIR_NAMES.index("pair_" + pair)
        counts[p], sums[p] = values["count"], values["logSum"]
    return counts, sums


def fixture_bytes(model):
    histories = {
        "typical-70-wpm": [sentence(th=(2, 9.54), er=(1, 4.94), at=(1, 5.19)),
                           sentence(th=(1, 4.80), st=(1, 5.32), he=(1, 5.60)),
                           sentence(he=(1, 5.54), er=(2, 9.96))],
        "beyond-support-190-wpm": [sentence(th=(2, 7.54), er=(1, 3.95), at=(1, 4.19)),
                                   sentence(on=(1, 3.71), th=(1, 4.60), at=(1, 4.16))],
        "one-and-three-intervals": [sentence(er=(1, 4.79), at=(1, 5.04)),
                                    sentence(th=(1, 5.05), he=(3, 15.45))],
        "first-sentence": [sentence(aa=(1, 5.40), zz=(2, 10.80))],
    }
    cases = []
    for name, sentences in histories.items():
        expected = [{"checks": n, "inside": k}
                    for n, k in sentence_checks(model, map(pair_arrays, sentences))]
        cases.append({"name": name, "sentences": sentences, "expected": expected})
    fixture = {"modelSha256": PINS["fitted_model"], "cases": cases}
    # One JSON line without a line ending stays byte-identical in LF and CRLF checkouts.
    return json.dumps(fixture, separators=(",", ":"), allow_nan=False).encode("utf-8")


class FitCheckTests(unittest.TestCase):
    def setUp(self):
        zero = np.zeros(PAIRS)
        speed = Speed(0.0, -1.0, 1.0, zero, zero, np.ones(PAIRS))
        self.model = Model(speed, np.full(PAIRS, 0.25), np.full(PAIRS, 0.75))

    def test_range_includes_both_boundaries_and_excludes_the_next_float(self):
        first = pair_arrays(sentence(er=(1, 0.0)))
        # The unseen pair has prediction zero and total variance one for a single interval.
        for sign in (-1, 1):
            edge = sign * RANGE_Z
            for value, inside in ((edge, 1), (np.nextafter(edge, sign * np.inf), 0)):
                with self.subTest(value=value):
                    second = pair_arrays(sentence(th=(1, value)))
                    self.assertEqual(sentence_checks(self.model, [first, second])[1], (1, inside))

    def test_first_sentence_is_unchecked_and_informs_the_second(self):
        observation = pair_arrays(sentence(th=(1, 5.0)))
        self.assertEqual(sentence_checks(self.model, [observation, observation]), [(0, 0), (1, 1)])

    def test_regenerating_with_the_published_fit_gives_identical_bytes(self):
        table = json.loads(TABLE.read_bytes())
        self.assertEqual(table["modelSha256"], PINS["fitted_model"])
        # The export contains every L5 parameter. Only the older baseline uses population_pair.
        speed = Speed(table["center"], table["low"], table["high"], np.full(PAIRS, np.nan),
                      np.array(table["a"]), np.array(table["b"]))
        model = Model(speed, np.array(table["tau2"]), np.array(table["sigma2"]))
        self.assertEqual(fixture_bytes(model), FIXTURE.read_bytes())

    def test_threshold_uses_eligible_typists_and_counts_ties_in_band_shares(self):
        wpm = np.array([35, 45, 55, 105, 125])
        totals = np.array([[8, 100, 65], [8, 100, 66], [8, 100, 85], [8, 100, 85], [7, 100, 60]])
        result = summarize(wpm, totals)
        self.assertEqual(result["threshold"], 0.65)
        self.assertEqual(result["bands"]["all"]["pooled_coverage"], 361 / 500)
        self.assertEqual(result["bands"]["all"]["share_at_or_below"], 1 / 4)
        self.assertEqual(result["bands"]["<40"]["at_or_below"], 1)
        self.assertEqual(result["bands"]["<40"]["below"], 0)
        self.assertIsNone(result["bands"]["120+"]["per_typist_percentiles"])

    def test_misspecified_ranges_stop_calibration(self):
        for inside in (69, 91):
            with self.subTest(inside=inside), self.assertRaisesRegex(ValueError, "Pooled validation coverage"):
                summarize(np.array([70]), np.array([[8, 100, inside]]))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("train", type=Path, help="Registered dataset-v2/train.npz")
    FIXTURE.write_bytes(fixture_bytes(registered_fit(parser.parse_args().train)))
