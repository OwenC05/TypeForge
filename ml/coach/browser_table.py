"""Export the registered L5 training fit for the browser."""

import argparse
import json
from pathlib import Path

from .b6 import require_pin
from .model import COACH_Z, GAP, MIN_COUNT, RANGE_Z
from .validation import CORPUS, ROOT, coach_inputs, file_hash, fit_training, text_hash

TABLE = ROOT / "typing-app/client/src/generated/coach-model.json"


def fitted_table(train):
    train_sha = require_pin("train.npz", file_hash(train))
    corpus_sha = require_pin("pair_frequencies.json_LF", text_hash(CORPUS))
    model, _, stats = fit_training(train)
    model_sha = require_pin("fitted_model", stats["model_sha256"])
    _, frequency = coach_inputs()
    return model, {
        "version": 1, "modelSha256": model_sha, "trainSha256": train_sha,
        "pairFrequenciesSha256": corpus_sha,
        "center": model.speed.center, "low": model.speed.low, "high": model.speed.high,
        "a": model.speed.a.tolist(), "b": model.speed.b.tolist(),
        "sigma2": model.sigma2.tolist(), "tau2": model.tau2.tolist(),
        "frequency": frequency.tolist(),
        "MIN_COUNT": MIN_COUNT, "GAP": GAP, "COACH_Z": COACH_Z, "RANGE_Z": RANGE_Z,
    }


def export(train, destination=TABLE):
    _, table = fitted_table(train)
    destination.write_text(json.dumps(table, allow_nan=False, separators=(",", ":")) + "\n",
                           encoding="utf-8", newline="\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("train", type=Path, help="Registered B3 train.npz")
    export(parser.parse_args().train)
