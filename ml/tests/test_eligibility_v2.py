"""Only invented events are used here; both implementations consume the same JSON cases."""

import json
import math
import unittest
from pathlib import Path

from ml.eligibility_v2 import METRIC_VERSION, eligible, replay, replay_aalto


FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "eligibility-v2.json"


def rows(target, final, keys):
    return [
        {"PARTICIPANT_ID": "synthetic", "TEST_SECTION_ID": "example",
         "SENTENCE": target, "USER_INPUT": final, "KEYSTROKE_ID": str(i + 1),
         "PRESS_TIME": str(time), "KEYCODE": str(code), "LETTER": label}
        for i, (time, code, label) in enumerate(keys)
    ]


def aalto(records):
    return replay_aalto(records, layout="qwerty", keyboard_type="laptop")


class EligibilityV2Tests(unittest.TestCase):
    def test_shared_fixture_contract(self):
        data = json.loads(FIXTURES.read_text(encoding="utf-8"))
        self.assertEqual(data["metricVersion"], METRIC_VERSION)
        cases = data["cases"]
        self.assertGreaterEqual(len(cases), 30)
        self.assertEqual(len(cases), len({case["name"] for case in cases}))
        for case in cases:
            with self.subTest(name=case["name"]):
                result = replay(case["target"], case["events"], case["final"],
                                submitted=case.get("submitted", True), qwerty=case.get("qwerty", True))
                self.assertEqual(eligible(result), case["expected"])

    def test_raw_sort_shift_and_physical_double_letter(self):
        records = rows("Book", "Book", [(0, 16, "Shift"), (20, 66, "B"), (90, 79, "o"),
                                        (140, 79, "o"), (250, 75, "k")])
        self.assertEqual(eligible(aalto(records[::-1])), {
            "reason": None, "intervals": [
                {"pair": "oo", "fromIndex": 1, "toIndex": 2, "ms": 50},
                {"pair": "ok", "fromIndex": 2, "toIndex": 3, "ms": 110},
            ]})

    def test_error_onset_restoration_distance_and_first_attempts(self):
        keys = [(0, 65, "a"), (100, 66, "b"), (200, 88, "x"), (300, 8, "Bksp"),
                (400, 67, "c"), (500, 68, "d"), (600, 69, "e"), (700, 70, "f")]
        result = aalto(rows("abcdef", "abcdef", keys))
        self.assertIsNone(result.reason)
        self.assertEqual(eligible(result), {"reason": "clean-copy-required", "intervals": []})
        self.assertEqual([(m.pair, m.post, m.pre, m.next_disruption, m.error, m.first)
                          for m in result.measurements], [
            ("ab", None, 1, "error", False, True),
            ("bc", None, 1, "delete", True, True),  # observed b -> x; intended bc
            ("cd", 1, None, None, False, False),    # c is a retype at the x position
            ("de", 2, None, None, False, True),
            ("ef", 3, None, None, False, True),
        ])

    def test_bare_delete_and_spaces_count_as_physical_strokes(self):
        keys = [(0, 65, "a"), (10, 66, "b"), (20, 32, " "), (30, 8, "Backspace"),
                (40, 32, " "), (50, 67, "c"), (55, 16, "Shift"), (60, 68, "d")]
        result = aalto(rows("ab cd", "ab cd", keys))
        self.assertEqual([(m.pair, m.post, m.pre, m.next_disruption) for m in result.measurements],
                         [("ab", None, 2, "delete"), ("cd", 2, None, None)])

    def test_wrong_prefix_never_generates_clean_suffix_evidence(self):
        result = aalto(rows("abcd", "axcd", [(0, 65, "a"), (1, 88, "x"), (2, 67, "c"), (3, 68, "d")]))
        self.assertEqual([(m.pair, m.error) for m in result.measurements], [("ab", True)])
        self.assertFalse(eligible(result)["intervals"])

    def test_unreliable_source_rejects_the_whole_sentence(self):
        good = rows("ab", "ab", [(0, 65, "a"), (120, 66, "b")])
        for change, reason in [
                ({"USER_INPUT": "a"}, "invalid-trial"), ({"SENTENCE": "a"}, "invalid-trial"),
                ({"PARTICIPANT_ID": "different"}, "invalid-trial"), ({"TEST_SECTION_ID": "other"}, "invalid-trial"),
                ({"KEYSTROKE_ID": "1"}, "invalid-trial"), ({"KEYSTROKE_ID": "bad"}, "invalid-trial"),
                ({"PRESS_TIME": "nan"}, "invalid-time"), ({"PRESS_TIME": "-1"}, "invalid-time"),
                ({"PRESS_TIME": "0"}, "invalid-time"), ({"KEYCODE": "37"}, "unsupported-edit"),
                ({"KEYCODE": "17"}, "unsupported-edit"), ({"KEYCODE": "229"}, "untracked-input"),
                ({"LETTER": "Dead"}, "untracked-input")]:
            with self.subTest(change=change):
                result = aalto([good[0], {**good[1], **change}])
                self.assertEqual(eligible(result), {"reason": reason, "intervals": []})
        self.assertEqual(aalto([]).reason, "invalid-trial")
        self.assertEqual(aalto([{**r, "USER_INPUT": "a"} for r in good]).reason, "final-mismatch")
        for layout, keyboard in [("azerty", "full"), ("qwerty", "touch")]:
            with self.subTest(layout=layout, keyboard=keyboard):
                self.assertEqual(replay_aalto(good, layout=layout, keyboard_type=keyboard).reason,
                                 "unsupported-layout")

    def test_bad_neutral_clock_abandons_provisional_pairs(self):
        for time in (None, "2", True, -1, math.nan, math.inf, 10**400):
            with self.subTest(time=time):
                trial = replay("abc", [{"kind": "insert", "text": c, "t": t}
                                       for c, t in zip("abc", (0, 1, time))], "abc")
                self.assertEqual(eligible(trial), {"reason": "invalid-time", "intervals": []})


class BiasAnalysisTests(unittest.TestCase):
    def test_score_excludes_the_fit_sentence_and_unseen_pairs(self):
        from ml.analysis.eligibility_v2_bias import Typist, score_person

        clean = aalto(rows("ab", "ab", [(0, 65, "a"), (100, 66, "b")]))
        edited = aalto(rows("abcd", "abcz", [(0, 65, "a"), (400, 66, "b"),
                                             (500, 67, "c"), (600, 90, "z")]))
        person = Typist("<40")
        score_person(person, "synthetic", [("one", clean), ("two", edited)])
        self.assertEqual(person.diagnostics.get("clean", []), [])
        self.assertEqual(person.available.sum(), 2)
        self.assertEqual(person.matched.sum(), 1)
        self.assertAlmostEqual(person.log_sum.sum(), math.log(4))
        self.assertEqual(person.diagnostics.get("wrong", []), [])  # intended cd has no clean fit

    def test_bootstrap_weights_typists_equally_and_suppresses_singletons(self):
        from ml.analysis.eligibility_v2_bias import estimate

        effect = estimate([1, 100], [math.log(4), 0])
        self.assertAlmostEqual(effect["pct"], 100)
        self.assertAlmostEqual(effect["ci95"][0], 0)
        self.assertAlmostEqual(effect["ci95"][1], 300)
        self.assertEqual(estimate([1], [math.log(4)]),
                         {"typists": 1, "intervals": 1, "pct": None, "ci95": None})


if __name__ == "__main__":
    unittest.main()
