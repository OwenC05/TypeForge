"""Export the frozen browser model, aggregate benchmark and synthetic parity cases."""

import json
from pathlib import Path
from typing import Any

from .config import (
    GENERATED,
    HISTORY_SENTENCES,
    MAX_INTERVAL_MS,
    PARITY,
    PARTICIPANTS,
    SOURCE,
    digest,
    read_json,
    write_json,
)
from .features import NAMES
from .parity import parity_fixture

LIMITATIONS = [
    (
        "Public source lacks focus, composition and key-repeat flags; reconstructable exact "
        "copying is not identical browser instrumentation."
    ),
    "Correct-copy filtering introduces selection bias; errors are audited separately.",
    "English physical QWERTY cohort; no cross-layout/mobile claim.",
    "Seen-text means nonreserved prompt partition; actual training overlap is separately reported.",
    "No independent TypeForge transfer validation; historical baseline remains the coach.",
    "Timing prediction accuracy does not establish typing-training efficacy.",
    (
        "Residual bounds describe individual transitions, not pair-average confidence or expected "
        "practice improvement."
    ),
]
REPRODUCTION = [
    "python -m ml.pipeline acquire --participants 2000 --seed 42 --max-bytes 268435456",
    "python -m ml.pipeline audit",
    "python -m ml.pipeline train",
    "python -m ml.pipeline evaluate --split test",
    "python -m ml.pipeline export",
]


def export(data_dir: Path, *, generated_dir: Path = GENERATED, parity_path: Path = PARITY) -> None:
    """Write v1 browser artifacts only for the frozen 2,000-participant source and evaluation."""
    config = read_json(data_dir / "config.json")
    report = read_json(data_dir / "evaluation.json")
    audit = read_json(data_dir / "audit.json")
    config_hash = digest(config)
    if report["configSha256"] != config_hash:
        raise ValueError("Evaluation/config mismatch")
    manifest_hash = digest(read_json(data_dir / "manifest.json"))
    if audit["rowsSha256"] != config["rowsSha256"] or manifest_hash != config["manifestSha256"]:
        raise ValueError("Audit/source differs from frozen experiment")
    if audit["acquiredParticipants"] != PARTICIPANTS:
        raise ValueError(
            "Release export requires exactly 2000 acquired participants; "
            "exploratory metrics cannot substitute"
        )
    model_version = "aalto-ridge-" + config_hash[:12]
    report_version = "benchmark-" + digest(report)[:12]
    ridge = config["models"]["ridge"]
    artifact: dict[str, Any] = {
        "artifactVersion": 1,
        "featureVersion": 1,
        "modelVersion": model_version,
        "status": "experimental",
        "task": {
            "language": "en",
            "layout": "qwerty",
            "lowercasePairsOnly": True,
            "historySentences": HISTORY_SENTENCES,
            "maxIntervalMs": MAX_INTERVAL_MS,
        },
        "featureNames": NAMES,
        "coefficients": ridge["coefficients"],
        "intercept": ridge["intercept"],
        "populationMeanLogMs": config["populationMeanLogMs"],
        "baseline": config["baseline"],
        "residualLogQuantiles": config["residualLogQuantiles"],
        "provenance": {
            "sourceUrl": SOURCE,
            "manifestSha256": manifest_hash,
            "configSha256": config_hash,
            "reportVersion": report_version,
        },
    }
    artifact_hash = digest(artifact)
    timings = data_dir / "timings.json"
    split_fields = ["participantSplit", "reservedPrompts", "primary", "secondary", "bootstrap"]
    benchmark = {
        "reportVersion": report_version,
        "modelVersion": model_version,
        "status": "experimental",
        "source": {
            "url": SOURCE,
            "name": "Aalto 136 million keystrokes",
            "license": "Non-commercial use with attribution; see source terms",
            "termsUrl": "https://userinterfaces.aalto.fi/136Mkeystrokes/",
        },
        "audit": audit,
        "splitDesign": {k: config[k] for k in split_fields},
        "selectedBaseline": config["baseline"],
        "selectedAlpha": ridge["alpha"],
        "validationBaselines": config["validationBaselines"],
        "validationModels": config["validationModels"],
        "evaluation": report,
        "environment": config["environment"],
        "hashes": {
            "artifactSha256": artifact_hash,
            "manifestSha256": manifest_hash,
            "configSha256": config_hash,
            "rowsSha256": config["rowsSha256"],
        },
        "limitations": LIMITATIONS,
        "stageTimingsSeconds": read_json(timings) if timings.exists() else {},
        "reproduction": REPRODUCTION,
    }
    fixture = parity_fixture(artifact, ridge["parityPredictions"])
    write_json(generated_dir / "model.json", artifact)
    write_json(generated_dir / "benchmark.json", benchmark)
    write_json(parity_path, fixture)
    print(
        json.dumps(
            {
                "modelVersion": model_version,
                "reportVersion": report_version,
                "artifactSha256": artifact_hash,
            }
        )
    )
