"""Explicit, preregistration-gated scoring of the published test split."""

import json
import math
from collections import defaultdict
from pathlib import Path
from typing import Any, cast

import numpy as np
from numpy.typing import NDArray
from scipy.stats import spearmanr

from .baselines import baseline
from .config import REGISTRATION, digest, read_json, write_json
from .dataset import load_trials
from .features import DesignMatrix, ObservationInfo, matrix
from .metrics import bootstrap, macro, score
from .ridge import predict
from .split import fingerprint

type Predictions = dict[str, NDArray[np.float64]]
SLICES = (
    ("primary", False, True),
    ("nonreserved-cold", False, False),
    ("reserved-warm", True, True),
    ("reserved-cold", True, False),
)


def _predictions(config: dict[str, Any], design: DesignMatrix) -> Predictions:
    population = config["populationMeanLogMs"]
    smoothed = (b for b in config["validationBaselines"] if b["kind"] == "smoothed-pair")
    k = min(smoothed, key=lambda b: b["maeMs"])["k"]
    values = {
        kind: baseline(design.info, population, kind, k)
        for kind in ("population", "user", "smoothed-pair")
    }
    chosen = config["baseline"]
    values["selected-baseline"] = baseline(design.info, population, chosen["kind"], chosen["k"])
    for name, model in config["models"].items():
        values[name] = predict(model, design.x)
    return values


def _slice_metrics(
    indices: list[int],
    design: DesignMatrix,
    values: Predictions,
    config: dict[str, Any],
    train_prompts: set[str],
    keys: list[str],
) -> dict[str, Any]:
    if not indices:
        return {
            "status": "unavailable",
            "reason": "No eligible observations",
            "participants": 0,
            "observations": 0,
            "metrics": None,
            "differenceCi95Ms": None,
        }
    selected = [design.info[i] for i in indices]
    labels = design.y[indices]
    metrics = {}
    for name, predictions in values.items():
        estimates = predictions[indices]
        log_errors: dict[str, list[float]] = defaultdict(list)
        for row, actual, estimate in zip(selected, labels, estimates):
            log_errors[row["pid"]].append(float(abs(actual - estimate)))
        metrics[name] = {"maeMs": score(labels, estimates, selected), "maeLog": macro(log_errors)}
    differences: dict[str, list[float]] = defaultdict(list)
    for i in indices:
        actual = np.exp(design.y[i])
        ridge_error = abs(actual - np.exp(values["ridge"][i]))
        baseline_error = abs(actual - np.exp(values["selected-baseline"][i]))
        differences[design.info[i]["pid"]].append(float(ridge_error - baseline_error))
    residual = labels - values["ridge"][indices]
    bounds = config["residualLogQuantiles"]
    return {
        "status": "available",
        "participants": len(differences),
        "observations": len(indices),
        "metrics": metrics,
        "differenceMs": macro(differences),
        "differenceCi95Ms": bootstrap(differences, config["bootstrap"]["seed"]),
        "intervalNote": "Descriptive small-cohort uncertainty; no power guarantee",
        "residualCoverage": float(
            np.mean((residual >= bounds["q10"]) & (residual <= bounds["q90"]))
        ),
        "actualTrainPromptOverlapFraction": sum(r["prompt"] in train_prompts for r in selected)
        / len(selected),
        "observationKeysSha256": digest(keys),
    }


def _ranking(
    primary: list[int], design: DesignMatrix, ridge: NDArray[np.float64]
) -> dict[str, Any]:
    pairs_by_user: dict[str, dict[str, list[tuple[float, float]]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for i in primary:
        row = design.info[i]
        pairs_by_user[row["pid"]][row["pair"]].append((float(design.y[i]), float(ridge[i])))
    rankings = []
    for pairs in pairs_by_user.values():
        qualified = [observations for observations in pairs.values() if len(observations) >= 8]
        if len(qualified) < 5:
            continue
        actual = [np.mean([a for a, _ in pair]) for pair in qualified]
        predicted = [np.mean([b for _, b in pair]) for pair in qualified]
        # For two one-dimensional samples SciPy returns one coefficient and one p-value.
        correlation, _ = cast(tuple[float, float], spearmanr(actual, predicted))
        if math.isfinite(correlation):
            rankings.append(correlation)
    return {
        "minPairObservations": 8,
        "minPairs": 5,
        "participants": len(rankings),
        "excludedParticipants": len(pairs_by_user) - len(rankings),
        "meanSpearman": float(np.mean(rankings)) if rankings else None,
        "status": "available" if rankings else "unavailable",
    }


def _history_band(row: ObservationInfo) -> str:
    if row["count"] < 50:
        return "1-49"
    return "50-199" if row["count"] < 200 else "200+"


def _strata(primary: list[int], design: DesignMatrix, values: Predictions) -> dict[str, Any]:
    strata = {}
    for dimension in ("speedBand", "historyCoverage"):
        groups: dict[str, list[int]] = defaultdict(list)
        for i in primary:
            row = design.info[i]
            key = row["speedBand"] if dimension == "speedBand" else _history_band(row)
            groups[key].append(i)
        strata[dimension] = {}
        for key, indices in groups.items():
            rows = [design.info[i] for i in indices]
            labels = design.y[indices]
            strata[dimension][key] = {
                "participants": len({r["pid"] for r in rows}),
                "observations": len(indices),
                "ridgeMaeMs": score(labels, values["ridge"][indices], rows),
                "baselineMaeMs": score(labels, values["selected-baseline"][indices], rows),
            }
    return strata


def evaluate(data_dir: Path, registration_path: Path = REGISTRATION) -> None:
    """Reproduce the four frozen test slices after checking source, rows and config hashes."""
    config = read_json(data_dir / "config.json")
    records = load_trials(data_dir)
    manifest_hash = digest(read_json(data_dir / "manifest.json"))
    if digest(records) != config["rowsSha256"] or manifest_hash != config["manifestSha256"]:
        raise ValueError("Frozen inputs changed")
    config_hash = digest(config)
    if read_json(registration_path)["configSha256"] != config_hash:
        raise ValueError("Missing/mismatched preregistration; holdout remains locked")
    design = matrix(records, config["populationMeanLogMs"], "test", include_reserved=True)
    values = _predictions(config, design)
    train_prompts = {
        fingerprint(r["prompt"]) for r in records if r["split"] == "train" and not r["reserved"]
    }
    slices = {}
    manifests = {}
    primary = []
    for name, is_reserved, warm in SLICES:
        indices = [
            i
            for i, r in enumerate(design.info)
            if r["reserved"] == is_reserved and r["warm"] == warm
        ]
        if name == "primary":
            primary = indices
        keys = [design.info[i]["key"] for i in indices]
        manifests[name] = keys
        slices[name] = _slice_metrics(indices, design, values, config, train_prompts, keys)
    all_keys = [key for keys in manifests.values() for key in keys]
    if len(set(all_keys)) != len(all_keys):
        raise ValueError("Overlapping evaluation slices")
    report = {
        "primaryStrata": _strata(primary, design, values),
        "configSha256": config_hash,
        "slices": slices,
        "ranking": _ranking(primary, design, values["ridge"]),
        "promotion": "Experimental only; no TypeForge transfer or training-efficacy evidence",
    }
    write_json(data_dir / "evaluation-keys.json", manifests)
    write_json(data_dir / "evaluation.json", report)
    print(json.dumps(report))
