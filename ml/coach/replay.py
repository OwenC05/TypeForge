"""Freeze early histories; score independent later clean trials for each typist."""

from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import numpy as np
from scipy.stats import binomtest, rankdata

from ml.config import HISTORY_SENTENCES
from ml.parse import occurrences
from .model import FAST_CUT, GAP, MARGIN, MIN_COUNT, PAIRS, RANGE_Z, suggestion, update

RUNGS = ("L0", "L1", "L2", "L3", "L5")
BANDS = ((-np.inf, 40), (40, 80), (80, 100), (100, 120), (120, np.inf))
BAND_NAMES = ("<40", "40–<80", "80–<100", "100–<120", "120+")
SENTENCES = ((0, 1), (1, 2), (2, 3), (3, 5), (5, np.inf))
SENTENCE_NAMES = ("0", "1", "2", "3–4", "5+")
REPLICATES = 2000
SEED = 20261124
MIN_SCORED_TYPISTS = 800


@dataclass
class Intervals:
    order: np.ndarray
    pair: np.ndarray
    y: np.ndarray
    position: np.ndarray

    def take(self, subset):
        return Intervals(self.order[subset], self.pair[subset], self.y[subset],
                         self.position[subset])

    def totals(self):
        return (np.bincount(self.pair, minlength=PAIRS),
                np.bincount(self.pair, weights=self.y, minlength=PAIRS))


@lru_cache(maxsize=4096)
def word_context(text):
    return {
        item.position: ((ord(item.pair[0]) - 97) * 26 + ord(item.pair[1]) - 97,
                        item.length, item.relative)
        for item in occurrences(text)
    }


def ridge_means(ridge, early, prompts, n):
    """Average the frozen linear model over observed early contexts for each pair."""
    weights, intercept, population = ridge
    geometry = np.empty(len(early.y))
    for order in np.unique(early.order):
        idx = np.flatnonzero(early.order == order)
        context = word_context(prompts[order])
        for i in idx:
            pair, length, relative = context[early.position[i]]
            if pair != early.pair[i]:
                raise ValueError("The interval and frozen Ridge prompt position disagree")
            geometry[i] = weights[PAIRS] * length + weights[PAIRS + 1] * relative
    geometry_sum = np.bincount(early.pair, weights=geometry, minlength=PAIRS)
    # The exported feature contract keeps the ten latest interval-bearing sentences.
    cutoff = np.unique(early.order)[-HISTORY_SENTENCES:][0]
    counts, sums = early.take(early.order >= cutoff).totals()
    own = sums.sum() / counts.sum() if counts.sum() else population
    pair_mean = np.divide(sums, counts, out=np.full(PAIRS, own), where=counts > 0)
    return (intercept + weights[:PAIRS] + geometry_sum / np.maximum(n, 1)
            + weights[-4] * own + weights[-3] * np.log1p(counts.sum())
            + weights[-2] * pair_mean + weights[-1] * np.log1p(counts))


def top_three(values):
    """Membership probabilities under a uniformly broken tie at rank three."""
    boundary = np.partition(values, -3)[-3]
    top = values > boundary
    tied = values == boundary
    return top.astype(float) + tied * ((3 - top.sum()) / tied.sum())


def rank_scores(predicted, actual):
    precision = np.dot(top_three(predicted), top_three(actual)) / 3
    if np.ptp(predicted) == 0 or np.ptp(actual) == 0:
        return precision, np.nan
    x, y = rankdata(predicted), rankdata(actual)
    x -= x.mean()
    y -= y.mean()
    return precision, np.dot(x, y) / np.sqrt(np.dot(x, x) * np.dot(y, y))


def matched_reference(l5_pick, counts, sums, frequency):
    """At L5 issuance, rank bank pairs by their raw mean minus their clean complement."""
    if l5_pick is None:
        return None
    other_n = counts.sum() - counts
    choices = np.flatnonzero((frequency > 0) & (counts >= MIN_COUNT) & (other_n > 0))
    if not len(choices):
        return None
    contrast = sums[choices] / counts[choices] - (sums.sum() - sums[choices]) / other_n[choices]
    return int(choices[np.argmax(contrast)])


def coaching_outcomes(pick, next_pick, later_n, later_gap):
    """Preserve unknown hits and both stability denominators in each typist's record."""
    row = {"yield": int(pick is not None), "confirmed_per_assigned": 0}
    if pick is not None and later_n[pick] >= MIN_COUNT:
        row["hit"] = int(later_gap[pick] > GAP)
        row["confirmed_per_assigned"] = row["hit"]
    if pick is not None or next_pick is not None:
        row["stability"] = int(pick == next_pick)
    if pick is not None and next_pick is not None:
        row["stability_both"] = int(pick == next_pick)
    return row


def replay_person(model, limited, ridge, frequency, clean, corrected, clean_trials, prompts, wpm):
    """Trial order is zero-based and includes rejected trials. Only outcomes use the later half."""
    cut = len(clean_trials) // 2
    early = clean.take(clean.order < cut)
    later = clean.take(clean.order >= cut)
    n, sums = early.totals()
    m, targets = later.totals()
    before, after = update(model, n, sums), update(model, m, targets)
    pick = suggestion(before, model, n, frequency)
    next_pick = suggestion(after, model, m, frequency)
    observed = targets / np.maximum(1, m)
    later_gap = observed - after.expected
    cells = (n >= MIN_COUNT) & (m >= MIN_COUNT)
    count = int(cells.sum())
    row: dict[str, float] = {
        "early_sentences": int(clean_trials[:cut].sum()), "cells": count,
        "candidate_available": int(np.any((frequency > 0) & (n >= MIN_COUNT))),
        **coaching_outcomes(pick, next_pick, m, later_gap),
    }
    reference = coaching_outcomes(matched_reference(pick, n, sums, frequency),
                                  matched_reference(next_pick, m, targets, frequency), m, later_gap)
    row.update({f"reference_{name}": value for name, value in reference.items()})
    row["paired_confirmed_gain"] = row["confirmed_per_assigned"] - reference["confirmed_per_assigned"]
    if n.sum():
        row["outside_support"] = int(not (model.speed.low <= before.speed <= model.speed.high))
    if corrected is not None:
        extra_n, extra_sum = corrected.take(corrected.order < cut).totals()
        augmented = update(model, n + extra_n, sums + extra_sum)
        extra_pick = suggestion(augmented, model, n + extra_n, frequency)
        row["D2_yield"] = int(extra_pick is not None)
        if extra_pick is not None and m[extra_pick] >= MIN_COUNT:
            row["D2_hit"] = int(later_gap[extra_pick] > GAP)
        if count:
            row["mae_D2"] = np.abs(augmented.prediction[cells] - observed[cells]).mean()
    if not count:
        return row

    predicted = {
        "L0": model.speed.population_pair[cells],
        "L1": np.full(count, before.own_mean),
        "L2": before.expected[cells],
        "L3": ridge_means(ridge, early, prompts[:cut], n)[cells],
        "L5": before.prediction[cells],
    }
    actual = observed[cells]
    for rung, pred in predicted.items():
        row[f"mae_{rung}"] = np.abs(pred - actual).mean()
        if count >= 4:
            gaps = pred - before.expected[cells]
            row[f"p3_{rung}"], row[f"rho_{rung}"] = rank_scores(gaps, later_gap[cells])
    half_range = RANGE_Z * np.sqrt(before.variance[cells] + model.sigma2[cells] / m[cells])
    row["coverage80"] = (np.abs(actual - predicted["L5"]) <= half_range).mean()
    row["gain_L1_L5"] = row["mae_L1"] - row["mae_L5"]
    row["gain_L2_L5"] = row["mae_L2"] - row["mae_L5"]
    row["gain_L3_L5"] = row["mae_L3"] - row["mae_L5"]
    # The shipped contrast also uses a raw personal target-pair mean.
    row["mae_own_pair"] = np.abs(sums[cells] / n[cells] - actual).mean()
    if corrected is not None:
        row["gain_D2"] = row["mae_L5"] - row["mae_D2"]
    if wpm >= FAST_CUT:
        restricted = update(limited, n, sums)
        for rung, pred in (("L2", restricted.expected), ("L5", restricted.prediction)):
            row[f"cut_{rung}"] = np.abs(pred[cells] - actual).mean()
            row[f"cut_cost_{rung}"] = row[f"cut_{rung}"] - row[f"mae_{rung}"]
    return row


def estimate(values):
    """Participant percentile bootstrap. Paired contrasts enter as within-person differences."""
    values = values[np.isfinite(values)]
    n = len(values)
    if n < 2:
        return {"typists": n, "mean": float(values[0]) if n else None, "ci95": None}
    if np.ptp(values) == 0:
        value = float(values[0])
        return {"typists": n, "mean": value, "ci95": [value, value]}
    rng = np.random.default_rng(SEED)
    means = np.empty(REPLICATES)
    for start in range(0, REPLICATES, 32):
        stop = min(REPLICATES, start + 32)
        index = rng.integers(n, size=(stop - start, n))
        means[start:stop] = values[index].mean(axis=1)
    return {"typists": n, "mean": float(values.mean()),
            "ci95": np.quantile(means, [0.025, 0.975]).tolist()}


def binary_estimate(values):
    result = estimate(values)
    n, hits = result["typists"], int(np.nansum(values))
    exact = binomtest(hits, n).proportion_ci(confidence_level=0.95, method="exact") if n else None
    return {**result, "successes": hits, "exact_ci95": list(exact) if exact is not None else None}


def choice_counts(metrics, prefix):
    assigned = metrics[prefix + "yield"]["typists"]
    issued = metrics[prefix + "yield"]["successes"]
    hits = metrics[prefix + "hit"]["successes"]
    adjudicable = metrics[prefix + "hit"]["typists"]
    unknown = issued - adjudicable
    return {
        "assigned": assigned, "issued": issued, "adjudicable": adjudicable, "hits": hits,
        "unknown": unknown, "same_pair": metrics[prefix + "stability"]["successes"],
        "either_half": metrics[prefix + "stability"]["typists"],
        "both_halves": metrics[prefix + "stability_both"]["typists"],
        "all_issued_hit_bounds": [hits / issued, (hits + unknown) / issued] if issued else None,
    }


def summarize(rows, wpm, include_corrected):
    """Publish aggregate metrics only. No identifiers or individual results leave replay."""
    def column(name):
        return np.array([row.get(name, np.nan) for row in rows])

    cells, early, issued = column("cells"), column("early_sentences"), column("yield")
    binary_names = [
        "candidate_available", "outside_support",
        *(prefix + key for prefix in ("", "reference_")
          for key in ("yield", "hit", "confirmed_per_assigned", "stability", "stability_both")),
    ]
    if include_corrected:
        binary_names.extend(("D2_yield", "D2_hit"))
    binary = {key: column(key) for key in binary_names}
    columns = {name: column(name) for name in (
        *(f"{metric}_{rung}" for metric in ("mae", "p3", "rho") for rung in RUNGS),
        "coverage80", "gain_L1_L5", "gain_L2_L5", "gain_L3_L5", "mae_own_pair",
        "paired_confirmed_gain",
    )}
    if include_corrected:
        columns.update({name: column(name) for name in ("mae_D2", "gain_D2")})
    groups = {"all": np.ones(len(wpm), dtype=bool)}
    groups.update({name: (wpm >= lo) & (wpm < hi) for name, (lo, hi) in zip(BAND_NAMES, BANDS)})
    bands = {}
    for name, keep in groups.items():
        metrics: dict[str, Any] = {key: estimate(values[keep]) for key, values in columns.items()}
        metrics.update({key: binary_estimate(values[keep]) for key, values in binary.items()})
        metrics.update({
            "assigned": int(keep.sum()), "scored_cells": int(cells[keep].sum()),
            "rank_cells": int(cells[keep & (cells >= 4)].sum()), "issued": int(issued[keep].sum()),
            "choice_counts": {"L5": choice_counts(metrics, ""),
                              "matched_reference": choice_counts(metrics, "reference_")},
            "yield_by_early_clean_sentences": {
                label: binary_estimate(issued[keep & (early >= lo) & (early < hi)])
                for label, (lo, hi) in zip(SENTENCE_NAMES, SENTENCES)
            },
        })
        if include_corrected:
            metrics["D2_issued"] = metrics["D2_yield"]["successes"]
        bands[name] = metrics
    cut_results = {}
    for name, keep in {"100+": wpm >= FAST_CUT, "100–<120": (wpm >= FAST_CUT) & (wpm < 120),
                       "120+": wpm >= 120}.items():
        cut_results[name] = {
            "assigned": int(keep.sum()), "scored_cells": int(cells[keep].sum()),
            **{key: estimate(column(key)[keep]) for key in (
                "mae_L2", "cut_L2", "cut_cost_L2", "mae_L5", "cut_L5", "cut_cost_L5")},
        }
    gain = bands["all"]["gain_L1_L5"]
    enough = gain["typists"] >= MIN_SCORED_TYPISTS
    clears_margin = enough and gain["ci95"] is not None and gain["ci95"][0] > MARGIN
    decision = "pass" if clears_margin else "fail_margin"
    if not enough:
        decision = "fail_insufficient_data"
    scored_wpm = wpm[(cells > 0) & np.isfinite(wpm)]
    return {
        "primary_margin_log_ms": MARGIN,
        "primary_min_scored_typists": MIN_SCORED_TYPISTS,
        "primary_decision": decision,
        "primary_lower_bound_exceeds_margin": clears_margin,
        "maximum_scored_wpm": float(scored_wpm.max()) if len(scored_wpm) else None,
        "bands": bands, "speed_cut": cut_results,
    }
