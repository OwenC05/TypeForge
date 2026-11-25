"""Predict and select the population, participant and smoothed letter-pair baselines."""

from collections.abc import Sequence
from typing import TYPE_CHECKING, TypedDict

from .config import SMOOTHING
from .features import BaselineHistory, DesignMatrix
from .metrics import score

if TYPE_CHECKING:
    import numpy as np
    from numpy.typing import NDArray


class BaselineScore(TypedDict):
    """A candidate's smoothing count and validation participant-macro MAE in milliseconds."""

    kind: str
    k: int
    maeMs: float


def baseline_log_ms(row: BaselineHistory, population: float, kind: str, k: int) -> float:
    """Predict log-ms with k pseudo-observations at the participant mean for smoothed pairs."""
    if kind == "population":
        return population
    if kind == "user":
        return row["user"]
    return (row["pairSum"] + k * row["user"]) / (row["pairCount"] + k)


def baseline(
    info: Sequence[BaselineHistory], population: float, kind: str, k: int = 0
) -> "NDArray[np.float64]":
    """Predict one log-ms value per row from the history available before its sentence."""
    import numpy as np

    return np.array([baseline_log_ms(row, population, kind, k) for row in info])


def select_baseline(
    validation: DesignMatrix, population: float
) -> tuple[BaselineScore, list[BaselineScore]]:
    """Select by validation participant-macro MAE (ms), keeping the first candidate on ties."""
    choices = [("population", 0), ("user", 0), *(("smoothed-pair", k) for k in SMOOTHING)]
    scores: list[BaselineScore] = []
    for kind, k in choices:
        prediction = baseline(validation.info, population, kind, k)
        mae = score(validation.y, prediction, validation.info)
        if mae is None:
            raise ValueError("Empty usable validation split")
        scores.append({"kind": kind, "k": k, "maeMs": mae})
    return min(scores, key=lambda candidate: candidate["maeMs"]), scores
