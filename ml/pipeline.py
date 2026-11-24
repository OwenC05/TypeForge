"""Compatibility entry point for `python -m ml.pipeline` and the v1 feature helpers."""

from .archive import RangeZip
from .baselines import baseline
from .cli import main
from .config import GENERATED, ROOT, SEED, SOURCE, digest
from .features import NAMES, features, matrix, summary_history
from .metrics import bootstrap, macro, score
from .parse import observations, occurrences, tsv
from .split import fingerprint, partition_participants, reserved

__all__ = [
    "GENERATED",
    "NAMES",
    "ROOT",
    "SEED",
    "SOURCE",
    "RangeZip",
    "baseline",
    "bootstrap",
    "digest",
    "features",
    "fingerprint",
    "macro",
    "main",
    "matrix",
    "observations",
    "occurrences",
    "partition_participants",
    "reserved",
    "score",
    "summary_history",
    "tsv",
]

if __name__ == "__main__":
    main()
