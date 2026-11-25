"""Synthetic, held-out-time and frozen-feature contracts for the coach."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

from ml.coach.model import GAP, PAIRS, Model, Speed, fit, suggestion, training_cells, update
from ml.coach.replay import (
    Intervals, binary_estimate, coaching_outcomes, estimate, matched_reference, rank_scores,
    replay_person, ridge_means, summarize,
)
from ml.coach.validation import coach_inputs, file_hash, score_split, validate
from ml.features import features
from ml.parse import occurrences


def flat_model():
    level = np.full(PAIRS, 5.0)
    speed = Speed(5.0, 4.5, 5.5, level, level, np.ones(PAIRS))
    return Model(speed, np.full(PAIRS, 0.25), np.full(PAIRS, 0.04))


def intervals(orders=(), pairs=(), y=(), pos=()):
    return Intervals(np.array(orders, dtype=int), np.array(pairs, dtype=int),
                     np.array(y, dtype=float), np.array(pos, dtype=int))


def index(pair):
    return (ord(pair[0]) - 97) * 26 + ord(pair[1]) - 97


class ModelTests(unittest.TestCase):
    def test_repeated_training_cells_separate_noise_from_persistent_personal_gaps(self):
        rng = np.random.default_rng(71)
        people, repeats = 80, 12
        who = np.repeat(np.arange(people), 2 * repeats)
        pair = np.tile([0, 1], people * repeats)
        sign = np.where(pair == 0, 1, -1)
        persistent = np.tile([-0.30, 0.30], people // 2)
        y = (5 + np.linspace(-0.4, 0.4, people)[who] + sign * persistent[who]
             + rng.normal(0, 0.12, size=len(who)))
        model = fit(training_cells(who, pair, y, people), people)
        np.testing.assert_allclose(model.sigma2[:2], 0.12**2, atol=0.002)
        np.testing.assert_allclose(model.tau2[:2], 0.30**2, atol=0.012)
        n = np.zeros(PAIRS)
        n[:2] = 4
        sums = np.zeros(PAIRS)
        sums[:2] = [4 * 5.3, 4 * 4.7]
        held = update(model, n, sums)
        np.testing.assert_allclose(held.prediction[:2], [5.3, 4.7], atol=0.035)

    def test_population_fit_finds_pair_and_speed_pattern_and_finite_rare_fallbacks(self):
        people = 35
        who = np.repeat(np.arange(people), 40)
        pair = np.tile([0, 1], len(who) // 2)
        offsets = np.linspace(-0.7, 0.7, people)
        y = np.where(pair == 0, 4.8 + 0.6 * offsets[who], 5.2 + 1.4 * offsets[who])
        y += np.tile([0.02, 0.03, -0.02, -0.03], len(who) // 4)
        model = fit(training_cells(who, pair, y, people), people)
        np.testing.assert_allclose(model.speed.a[:2], [4.8, 5.2], atol=0.01)
        np.testing.assert_allclose(model.speed.b[:2], [0.6, 1.4], atol=0.03)
        np.testing.assert_allclose(model.speed.population_pair[:2], [4.8, 5.2])
        self.assertAlmostEqual(model.speed.b[2], 1)
        self.assertLess(model.speed.low, model.speed.high)
        self.assertTrue((model.sigma2 > 0).all() and (model.tau2 > 0).all())

    def test_speed_adjusts_for_pair_mix_and_keeps_level_beyond_boundary(self):
        model = flat_model()
        model.speed.a[:2] = [4.5, 5.5]
        model.speed.b[:2] = [0.6, 1.4]
        for n1, n2 in ((1, 25), (25, 1)):
            n = np.zeros(PAIRS)
            n[:2] = [n1, n2]
            state = update(model, n, n * (model.speed.a - 0.8))
            self.assertAlmostEqual(state.speed, 4.2)
            np.testing.assert_allclose(state.expected, model.speed.expected(4.5) - 0.3)
        np.testing.assert_allclose(model.speed.expected(6.0), model.speed.expected(5.5) + 0.5)

    def test_posterior_matches_normal_normal_and_recomputes_after_new_sentence(self):
        model = flat_model()
        first = intervals([0, 0, 0], [0, 0, 1], [5.4, 5.2, 4.9], [1, 2, 3])
        second = intervals([1, 1], [1, 2], [4.6, 4.1], [1, 2])
        n1, s1 = first.totals()
        n2, s2 = second.totals()
        n, total = n1 + n2, s1 + s2
        state = update(model, n, total)
        self.assertAlmostEqual(state.speed, np.mean([5.4, 5.2, 4.9, 4.6, 4.1]))
        var = 1 / (1 / model.tau2[0] + n[0] / model.sigma2[0])
        self.assertAlmostEqual(state.variance[0], var)
        expected_gap = var * (total[0] - n[0] * state.speed) / model.sigma2[0]
        self.assertAlmostEqual(state.gap[0], expected_gap)
        self.assertGreater(state.gap[0], update(model, n1, s1).gap[0])
        self.assertEqual(state.gap[3], 0)
        self.assertEqual(state.variance[3], model.tau2[3])

    def test_suggestion_requires_evidence_and_ranks_by_expected_time_lost(self):
        model = flat_model()
        n = np.zeros(PAIRS)
        n[:4] = [4, 4, 100, 1]
        y = np.full(PAIRS, 5.0)
        y[:4] = [5.9, 5.6, 5, 8]
        freq = np.zeros(PAIRS)
        freq[:4] = [1, 100, 1, 100]
        state = update(model, n, n * y)
        self.assertEqual(suggestion(state, model, n, freq), 1)
        freq[1] = 0
        self.assertEqual(suggestion(state, model, n, freq), 0)
        n[:2] = 1
        self.assertIsNone(suggestion(update(model, n, n * y), model, n, freq))
        self.assertIsNone(suggestion(update(model, n, n * 5), model, n, freq))


class ReplayTests(unittest.TestCase):
    def test_matched_reference_uses_the_complement_and_breaks_ties_alphabetically(self):
        n = np.array([20, 2, 10, 1])
        sums = n * [5.6, 5.9, 4.0, 12.0]
        bank = np.array([1, 1, 0, 1])
        self.assertIsNone(matched_reference(None, n, sums, bank))
        self.assertEqual(matched_reference(1, n, sums, bank), 0)
        self.assertEqual(matched_reference(1, np.array([2, 2]), np.array([8, 8]), bank[:2]), 0)
        self.assertIsNone(matched_reference(0, np.array([2, 0]), np.array([8, 0]), bank[:2]))

    def test_choice_denominators_unknown_bounds_and_paired_confirmations(self):
        n, gaps = np.array([2, 1, 3]), np.array([0.3, 0.4, -0.1])
        rows = []
        for pick, later, matched, matched_later in (
            (0, 0, 1, 0), (1, None, 0, None), (0, 1, 2, 2), (None, None, None, None),
        ):
            l5 = coaching_outcomes(pick, later, n, gaps)
            ref = coaching_outcomes(matched, matched_later, n, gaps)
            rows.append({"early_sentences": 2, "cells": 0, **l5,
                         **{"reference_" + k: v for k, v in ref.items()},
                         "paired_confirmed_gain": l5["confirmed_per_assigned"]
                                                  - ref["confirmed_per_assigned"]})
        group = summarize(rows, np.full(4, 50), False)["bands"]["all"]
        expected = {"assigned": 4, "issued": 3, "adjudicable": 2, "hits": 2, "unknown": 1,
                    "same_pair": 1, "both_halves": 2, "either_half": 3,
                    "all_issued_hit_bounds": [2/3, 1.0]}
        self.assertEqual(group["choice_counts"]["L5"], expected)
        self.assertEqual(group["choice_counts"]["matched_reference"],
                         {**expected, "hits": 1, "all_issued_hit_bounds": [1/3, 2/3]})
        self.assertEqual(group["paired_confirmed_gain"], estimate(np.array([1, -1, 1, 0])))

    def test_exact_binary_intervals_and_information_floor(self):
        self.assertIsNone(binary_estimate(np.array([np.nan]))["exact_ci95"])
        one = binary_estimate(np.array([0]))
        self.assertIsNone(one["ci95"])
        np.testing.assert_allclose(one["exact_ci95"], [0, 0.975])
        np.testing.assert_allclose(binary_estimate(np.ones(6))["exact_ci95"],
                                   [0.025 ** (1/6), 1])
        for size, delta, decision in ((799, 0.03, "fail_insufficient_data"),
                                      (800, 0.02, "fail_margin"), (800, 0.03, "pass")):
            rows = [{"early_sentences": 0, "cells": 1, "yield": 0, "gain_L1_L5": delta}] * size
            results = summarize(rows, np.full(size, np.nan), False)
            self.assertEqual(results["primary_decision"], decision)
            self.assertEqual(results["primary_lower_bound_exceeds_margin"], decision == "pass")

    def test_entire_validation_entry_point_on_synthetic_hashed_files(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            wpm = np.array([35, 60, 80, 102, 121.0])
            who = np.repeat(np.arange(len(wpm)), 40)
            pairs = np.tile([index("th"), index("in")], len(who) // 2)
            order = np.tile(np.repeat(np.arange(4), 10), len(wpm))
            records = {
                "interval_typist": who, "interval_pair": pairs, "interval_trial_order": order,
                "interval_log_ms": 5.2 - who * 0.1 + (pairs == index("th")) * 0.2,
                "interval_position": np.tile(np.arange(1, 30, 3), len(who) // 10),
            }
            split = {
                "typist_index": np.arange(len(wpm)), "typist_avg_wpm_15": wpm,
                "typist_trials_eligible": np.full(len(wpm), 4),
                "typist_trials_replayed": np.full(len(wpm), 4),
                "trial_typist": np.repeat(np.arange(len(wpm)), 4),
                "trial_order": np.tile(np.arange(4), len(wpm)),
                "trial_reason": np.zeros(len(wpm) * 4, dtype=int),
                "reason_labels": np.array([""]),
                "trial_sentence": np.zeros(len(wpm) * 4, dtype=int),
                "sentences": np.array(["th in th in th in th in th in"]), **records,
            }
            for name in ("train.npz", "validation.npz"):
                np.savez(root / name, **split)
            np.savez(root / "validation-corrected.npz", **{k: v[:0] for k, v in records.items()})
            meta = root / "meta.json"
            files = {p.name: file_hash(p) for p in root.glob("*.npz")}
            meta.write_text(json.dumps({"files": files}))
            result = validate(root, file_hash(meta))
            self.assertEqual(result["training"]["assigned_at_or_above_cut"], 2)
            self.assertEqual(result["speed_cut"]["100+"]["cut_L2"]["typists"], 2)
            self.assertEqual(result["bands"]["all"]["scored_cells"], 10)
            self.assertEqual(result["bands"]["all"]["gain_D2"]["mean"], 0)
            self.assertGreater(result["bands"]["all"]["gain_L1_L5"]["mean"], 0.02)
            self.assertFalse(result["primary_lower_bound_exceeds_margin"])
            self.assertEqual(result["primary_decision"], "fail_insufficient_data")

    def test_frozen_ridge_equals_dense_export_on_early_word_contexts_with_history_cap(self):
        ridge, _ = coach_inputs()
        targets = ["aBcd can't cat", "cat can"] * 6
        orders, pairs, y, positions, history = [], [], [], [], []
        for i, prompt in enumerate(targets):
            sentence = []
            for position, pair, _, _ in occurrences(prompt):
                value = 4.3 + i / 10 + position / 100
                orders.append(i)
                pairs.append(index(pair))
                y.append(value)
                positions.append(position)
                sentence.append({"pair": pair, "log": value})
            history.append(sentence)
        early = intervals(orders, pairs, y, positions)
        actual = ridge_means(ridge, early, targets, early.totals()[0])
        weights, intercept, population = ridge
        expected = {}
        for prompt in targets:
            for position, pair, _, _ in occurrences(prompt):
                value = intercept + np.dot(features(prompt, position, history, population), weights)
                expected.setdefault(pair, []).append(value)
        for pair, values in expected.items():
            self.assertAlmostEqual(actual[index(pair)], np.mean(values), places=12)

    def test_chronology_rejections_d2_and_later_speed_ground_truth(self):
        model = flat_model()
        ridge, freq = coach_inputs()
        freq[:] = 0
        p, q = index("th"), index("in")
        freq[p] = 1
        # Seven submitted trials, early 0..2 (including a rejection), later 3..6.
        by_trial = [(0, 5.8, 4.6), (2, 5.8, 4.6), (3, 5.8, 4.6), (6, 5.8, 4.6)]
        data = intervals([o for o, _, _ in by_trial for _ in range(2)], [p, q] * 4,
                         [y for _, a, b in by_trial for y in (a, b)], [1, 4] * 4)
        early_prompts = ["th in", "", "th in"]
        flags = np.array([1, 0, 1, 1, 0, 0, 1], dtype=bool)
        def replay(extra):
            return replay_person(model, model, ridge, freq, data, extra, flags, early_prompts, 111)

        clean = replay(intervals())
        self.assertEqual(clean["early_sentences"], 2)
        self.assertEqual(clean["cells"], 2)
        self.assertEqual(clean["yield"], 1)
        self.assertEqual(clean["stability"], 1)
        self.assertEqual(clean["hit"], 1)
        self.assertAlmostEqual(clean["mae_L1"], 0.6)
        self.assertEqual(clean["gain_D2"], 0)
        self.assertEqual(clean["cut_cost_L5"], 0)
        changed = replay(intervals([1, 5], [p, q], [4.2, 7.0], [1, 4]))
        self.assertEqual(clean["mae_L5"], changed["mae_L5"])
        self.assertNotEqual(clean["mae_D2"], changed["mae_D2"])
        self.assertEqual(changed, replay(intervals([1, 5], [p, q], [4.2, 0.1], [1, 4])))

    def test_ties_and_unsupported_bootstrap_denominators(self):
        reference = np.array([0, 2, 1, 3.0])
        p3, rho = rank_scores(np.ones(4), reference)
        self.assertEqual(p3, 0.75)
        self.assertTrue(np.isnan(rho))
        p3, rho = rank_scores(reference, reference)
        self.assertEqual(p3, 1)
        self.assertAlmostEqual(rho, 1)
        self.assertEqual(estimate(np.array([np.nan])), {"typists": 0, "mean": None, "ci95": None})
        self.assertIsNone(estimate(np.array([0.3]))["ci95"])
        self.assertEqual(estimate(np.full(10, GAP))["ci95"], [GAP, GAP])

    def test_b3_arrays_keep_empty_typists_and_reject_mislabeled_intervals(self):
        model = flat_model()
        ridge, freq = coach_inputs()
        p = index("th")
        clean = {"interval_typist": np.array([0, 0, 0, 0]), "interval_pair": np.full(4, p),
                 "interval_trial_order": np.arange(4), "interval_position": np.ones(4, dtype=int),
                 "interval_log_ms": np.full(4, 5.0)}
        data = {"typist_index": np.arange(2), "typist_avg_wpm_15": np.array([120, 39]),
                "typist_trials_replayed": np.array([4, 0]), "trial_typist": np.zeros(4, dtype=int),
                "trial_order": np.arange(4), "reason_labels": np.array(["", "clean-copy-required"]),
                "trial_reason": np.zeros(4, dtype=int), "trial_sentence": np.zeros(4, dtype=int),
                "sentences": np.array(["th"]), **clean}
        corrected = {key: array[:0] for key, array in clean.items()}
        results = score_split(model, model, ridge, freq, data, corrected)
        bands = results["bands"]
        self.assertEqual(bands["all"]["assigned"], 2)
        self.assertEqual(bands["<40"]["yield_by_early_clean_sentences"]["0"]["typists"], 1)
        self.assertEqual(bands["120+"]["mae_L3"]["typists"], 1)
        self.assertEqual(bands["120+"]["scored_cells"], 1)
        self.assertIsNone(bands["120+"]["hit"]["mean"])
        self.assertFalse(results["primary_lower_bound_exceeds_margin"])  # one qualified typist
        clean_only = score_split(model, model, ridge, freq, data)["bands"]["all"]
        self.assertEqual(clean_only["mae_L5"], bands["all"]["mae_L5"])
        self.assertNotIn("mae_D2", clean_only)
        with self.assertRaisesRegex(ValueError, "trial reason"):
            score_split(model, model, ridge, freq, data, clean)

    def test_validate_rejects_changed_bytes_before_opening_arrays(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            path = root / "meta.json"
            path.write_text(json.dumps({"files": {"train.npz": "bad"}}))
            (root / "train.npz").write_bytes(b"fixture")
            with patch("numpy.load", side_effect=AssertionError("opened arrays")):
                with self.assertRaisesRegex(ValueError, "metadata SHA256"):
                    validate(root, "wrong")
                with self.assertRaisesRegex(ValueError, "train.npz"):
                    validate(root, file_hash(path))


if __name__ == "__main__":
    unittest.main()
