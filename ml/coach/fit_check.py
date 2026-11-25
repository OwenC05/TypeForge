"""Calibrate the L5 sentence-level fit check on the registered validation split."""

import argparse
import json
from math import floor
from pathlib import Path

import numpy as np

from .b6 import require_pin
from .model import PAIRS, RANGE_Z, update
from .replay import BAND_NAMES, BANDS
from .validation import file_hash, fit_training, grouped_intervals

MIN_SENTENCES = 8
PERCENTILES = (1, 2, 5, 10, 50)


def sentence_checks(model, sentences):
    """Return (checks, inside) per clean sentence, given ordered (pair counts, log sums) arrays."""
    prior_counts = np.zeros(PAIRS)
    prior_sums = np.zeros(PAIRS)
    results = []
    for i, (counts, sums) in enumerate(sentences):
        if i == 0:
            results.append((0, 0))
        else:
            state = update(model, prior_counts, prior_sums)
            pairs = np.flatnonzero(counts > 0)
            m = counts[pairs]
            error = np.abs(sums[pairs] / m - state.prediction[pairs])
            radius = RANGE_Z * np.sqrt(state.variance[pairs] + model.sigma2[pairs] / m)
            results.append((len(pairs), int(np.count_nonzero(error <= radius))))
        prior_counts += counts
        prior_sums += sums
    return results


def validation_counts(model, data):
    """Collect checked sentences, pair checks and inside counts for each validation typist."""
    wpm = data["typist_avg_wpm_15"]
    edges = np.r_[0, np.cumsum(data["typist_trials_replayed"], dtype=np.int64)]
    reasons = data["trial_reason"]
    clean_code = list(data["reason_labels"]).index("")
    clean, bounds = grouped_intervals(data, edges, reasons, clean_code)
    totals = np.zeros((len(wpm), 3), dtype=np.int64)
    for u in range(len(wpm)):
        rows = clean.take(slice(bounds[u], bounds[u + 1]))
        orders = np.flatnonzero(reasons[edges[u]:edges[u + 1]] == clean_code)
        sentences = (rows.take(rows.order == order).totals() for order in orders)
        for checks, inside in sentence_checks(model, sentences):
            totals[u] += (checks > 0, checks, inside)
    return wpm, totals


def summarize(wpm, totals):
    sentences, checks, inside = totals.T
    pooled = inside.sum() / checks.sum() if checks.any() else float("nan")
    if not 0.70 <= pooled <= 0.90:
        raise ValueError(f"Pooled validation coverage {pooled:.4f} is outside [0.70, 0.90]")
    eligible = sentences >= MIN_SENTENCES
    if not eligible.any():
        raise ValueError(f"No validation typist has {MIN_SENTENCES} checked sentences")
    # Divide in percent units so an exact whole percent stays integral before flooring.
    percent = np.divide(100 * inside, checks, out=np.full(len(wpm), np.nan), where=checks > 0)
    threshold_percent = floor(np.percentile(percent[eligible], 2))

    groups = {"all": np.ones(len(wpm), dtype=bool)}
    groups.update({name: (lo <= wpm) & (wpm < hi) for name, (lo, hi) in zip(BAND_NAMES, BANDS)})
    bands = {}
    for name, group in groups.items():
        n = int(checks[group].sum())
        k = int(inside[group].sum())
        values = percent[group & eligible]
        at_or_below = int(np.count_nonzero(values <= threshold_percent))
        quantiles = (np.percentile(values, PERCENTILES) / 100).tolist() if len(values) else None
        bands[name] = {
            "assigned": int(group.sum()), "typists_with_checks": int(np.count_nonzero(checks[group])),
            "checked_sentences": int(sentences[group].sum()), "checks": n, "inside": k,
            "pooled_coverage": k / n if n else None, "eligible_typists": len(values),
            "per_typist_percentiles": quantiles, "below": int(np.count_nonzero(values < threshold_percent)),
            "at_or_below": at_or_below,
            "share_at_or_below": at_or_below / len(values) if len(values) else None,
        }
    return {"threshold": threshold_percent / 100, "percentiles": PERCENTILES, "bands": bands}


def registered_fit(train):
    require_pin("train.npz", file_hash(train))
    model, _, stats = fit_training(train)
    require_pin("fitted_model", stats["model_sha256"])
    return model


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path, help="Registered dataset-v2 directory")
    directory = parser.parse_args().directory
    validation = directory / "validation.npz"
    require_pin("validation.npz", file_hash(validation))
    model = registered_fit(directory / "train.npz")
    with np.load(validation, allow_pickle=False) as data:
        result = summarize(*validation_counts(model, data))
    print(json.dumps(result, indent=2, allow_nan=False, ensure_ascii=False))


if __name__ == "__main__":
    main()
