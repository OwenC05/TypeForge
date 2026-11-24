"""Participant-macro errors and the frozen participant bootstrap."""

from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import TYPE_CHECKING

from .config import BOOTSTRAP_REPLICATES
from .features import ObservationInfo

if TYPE_CHECKING:
    import numpy as np
    from numpy.typing import NDArray

type ParticipantErrors = Mapping[str, Sequence[float]]


def macro(errors: ParticipantErrors) -> float | None:
    """Average within each participant, then weight participants equally. Empty is unavailable."""
    if not errors:
        return None
    return sum(sum(values) / len(values) for values in errors.values()) / len(errors)


def score(
    y: "NDArray[np.float64]", pred: "NDArray[np.float64]", info: Sequence[ObservationInfo]
) -> float | None:
    """Score natural-log-ms predictions by participant-macro absolute error in milliseconds."""
    import numpy as np

    errors: dict[str, list[float]] = defaultdict(list)
    for actual, estimate, row in zip(np.exp(y), np.exp(pred), info):
        errors[row["pid"]].append(float(abs(actual - estimate)))
    return macro(errors)


def bootstrap(errors: ParticipantErrors, seed: int) -> list[float] | None:
    """Percentile 95% interval from 2,000 resamples of participants. Requires at least two."""
    if len(errors) < 2:
        return None
    import numpy as np

    values = np.array([sum(v) / len(v) for _, v in sorted(errors.items())])
    rng = np.random.default_rng(seed)
    samples = [
        rng.choice(values, len(values), replace=True).mean() for _ in range(BOOTSTRAP_REPLICATES)
    ]
    return np.quantile(samples, [0.025, 0.975]).tolist()
