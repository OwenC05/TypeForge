"""Fit on training participants, select on validation and freeze the experiment."""

import json
import sys
from pathlib import Path
from typing import Any

from .baselines import select_baseline
from .config import (
    ALPHAS,
    BOOTSTRAP_REPLICATES,
    HISTORY_SENTENCES,
    REGISTRATION,
    SMOOTHING,
    digest,
    read_json,
    write_json,
)
from .dataset import load_trials
from .features import matrix
from .ridge import fit_ridge_models, predict


def preregistration(config: dict[str, Any]) -> dict[str, Any]:
    """Freeze the input hashes, fitted configuration, choices and test estimand."""
    fields = [
        "seed",
        "historySentences",
        "participantSplit",
        "reservedPrompts",
        "primary",
        "secondary",
        "bootstrap",
        "manifestSha256",
        "rowsSha256",
        "baseline",
    ]
    return {
        **{key: config[key] for key in fields},
        "configSha256": digest(config),
        "selectedAlpha": config["models"]["ridge"]["alpha"],
        "status": "frozen-before-test-unlock",
        "selectionPopulation": (
            "nonreserved validation participants; participant-macro millisecond MAE"
        ),
        "alphaCandidates": list(ALPHAS),
        "smoothingCandidates": list(SMOOTHING),
    }


def train(data_dir: Path, registration_path: Path = REGISTRATION) -> None:
    """Write the selected config and registration. Reject a changed config after test unlock."""
    import numpy as np
    import scipy
    import sklearn

    records = load_trials(data_dir)
    manifest = read_json(data_dir / "manifest.json")
    population = float(
        np.mean(
            [
                obs["log"]
                for trial in records
                if trial["split"] == "train" and not trial["reserved"]
                for obs in trial["observations"]
            ]
        )
    )
    training = matrix(records, population, "train")
    validation = matrix(records, population, "validation")
    chosen, baseline_scores = select_baseline(validation, population)
    models, ridge_scores = fit_ridge_models(training, validation, population)
    selected = models["ridge"]
    residual = validation.y - predict(selected, validation.x)
    config = {
        "seed": manifest["seed"],
        "historySentences": HISTORY_SENTENCES,
        "participantSplit": "sha256(seed:split:id) ranked acquired participants: "
        "exact 70/15/15 before eligibility",
        "reservedPrompts": "sha256(lowercase whitespace-normalized prompt) modulo 5 == 0",
        "primary": "test/nonreserved/warm participant-macro MAE full ridge minus selected baseline",
        "secondary": ["nonreserved-cold", "reserved-warm", "reserved-cold"],
        "bootstrap": {
            "seed": manifest["seed"],
            "unit": "participant",
            "replicates": BOOTSTRAP_REPLICATES,
            "interval": 0.95,
        },
        "populationMeanLogMs": population,
        "baseline": {
            "kind": chosen["kind"],
            "k": chosen["k"],
            "version": f"aalto-{chosen['kind']}-k{chosen['k']}-v1",
        },
        "models": models,
        "residualLogQuantiles": dict(
            zip(["q10", "q90"], np.quantile(residual, [0.1, 0.9]).tolist())
        ),
        "manifestSha256": digest(manifest),
        "rowsSha256": digest(records),
        "validationBaselines": baseline_scores,
        "validationModels": ridge_scores,
        "environment": {
            "python": sys.version,
            "numpy": np.__version__,
            "scipy": scipy.__version__,
            "scikitLearn": sklearn.__version__,
        },
    }
    config_hash = digest(config)
    if (data_dir / "evaluation.json").exists() and digest(
        read_json(data_dir / "config.json")
    ) != config_hash:
        raise ValueError(
            "Test already unlocked: changed configuration requires a new untouched holdout"
        )
    write_json(data_dir / "config.json", config)
    write_json(registration_path, preregistration(config))
    print(
        json.dumps(
            {
                "configSha256": config_hash,
                "selectedBaseline": chosen,
                "selectedAlpha": selected["alpha"],
                "trainRows": len(training.y),
                "validationRows": len(validation.y),
            }
        )
    )
