"""The shared 682-column contract for fitted matrices and dense browser parity cases."""

import math
from collections import defaultdict
from collections.abc import Sequence
from string import ascii_lowercase
from typing import TYPE_CHECKING, NamedTuple, TypedDict

from .config import HISTORY_SENTENCES
from .dataset import Trial
from .parse import HistoryPair, occurrences
from .split import Split, fingerprint

if TYPE_CHECKING:
    import numpy as np
    from numpy.typing import NDArray
    from scipy.sparse import csr_matrix

PAIR_NAMES = [f"pair_{a}{b}" for a in ascii_lowercase for b in ascii_lowercase]
NAMES = PAIR_NAMES + [
    "word_length",
    "pair_position",
    "user_mean_log_ms",
    "user_log_count",
    "pair_mean_log_ms",
    "pair_log_count",
]
type History = Sequence[Sequence[HistoryPair]]


class PairTotals(NamedTuple):
    """Number and sum of log-ms intervals for a single lowercase pair."""

    count: int = 0
    log_sum: float = 0


class HistoryTotals(NamedTuple):
    """Counts and unrounded log-ms sums for a participant's earlier eligible sentences."""

    count: int
    log_sum: float
    pairs: dict[str, PairTotals]

    def mean(self, population: float) -> float:
        """Use the train population mean log-ms until the participant has history."""
        return self.log_sum / self.count if self.count else population


class BaselineHistory(TypedDict):
    """Participant mean log-ms, pair log-ms sum and pair count before the sentence."""

    user: float
    pairSum: float
    pairCount: int


class ObservationInfo(BaselineHistory):
    """Observation identity and pre-sentence history used for scoring and baselines."""

    pid: str
    key: str
    pair: str
    reserved: bool
    warm: bool
    count: int
    prompt: str
    speedBand: str


class DesignMatrix(NamedTuple):
    """Sparse features, natural-log-ms targets and aligned observation metadata."""

    x: "csr_matrix"
    y: "NDArray[np.float64]"
    info: list[ObservationInfo]


def summary_history(history: History) -> HistoryTotals:
    """Aggregate up to ten earlier sentences in order, counting every eligible pair."""
    count = 0
    total: float = 0
    pairs: dict[str, PairTotals] = {}
    for sentence in history[-HISTORY_SENTENCES:]:
        for observation in sentence:
            count += 1
            value = observation["log"]
            total += value
            pair = observation["pair"]
            previous = pairs.get(pair, PairTotals())
            pairs[pair] = PairTotals(previous.count + 1, previous.log_sum + value)
    return HistoryTotals(count, total, pairs)


def _pair_index(pair: str) -> int:
    return (ord(pair[0]) - ord("a")) * 26 + ord(pair[1]) - ord("a")


def _context(
    length: int, relative: float, user: float, count: int, pair: PairTotals
) -> list[float]:
    pair_mean = pair.log_sum / pair.count if pair.count else user
    return [length, relative, user, math.log1p(count), pair_mean, math.log1p(pair.count)]


def features(prompt: str, position: int, history: History, population: float) -> list[float]:
    """Build the dense vector for one second-letter offset using prior log-ms history only."""
    occurrence = next(o for o in occurrences(prompt) if o.position == position)
    totals = summary_history(history)
    vector = [0.0] * len(PAIR_NAMES)
    vector[_pair_index(occurrence.pair)] = 1
    return vector + _context(
        occurrence.length,
        occurrence.relative,
        totals.mean(population),
        totals.count,
        totals.pairs.get(occurrence.pair, PairTotals()),
    )


def matrix(
    records: Sequence[Trial], population: float, split: Split, include_reserved: bool = False
) -> DesignMatrix:
    """Build rows in trial order. Reserved sentences never enter a participant's history."""
    import numpy as np
    from scipy.sparse import csr_matrix

    data: list[float] = []
    indices: list[int] = []
    indptr = [0]
    targets = []
    info: list[ObservationInfo] = []
    histories: dict[str, list[Sequence[HistoryPair]]] = defaultdict(list)
    for trial in records:
        if trial["split"] != split:
            continue
        pid = trial["pid"]
        history = histories[pid]
        if not trial["reserved"] or include_reserved:
            totals = summary_history(history)
            user = totals.mean(population)
            prompt_hash = fingerprint(trial["prompt"])
            for obs in trial["observations"]:
                pair = totals.pairs.get(obs["pair"], PairTotals())
                indices.append(_pair_index(obs["pair"]))
                indices.extend(range(len(PAIR_NAMES), len(NAMES)))
                data.append(1)
                data.extend(_context(obs["length"], obs["relative"], user, totals.count, pair))
                indptr.append(len(data))
                targets.append(obs["log"])
                info.append(
                    {
                        "pid": pid,
                        "key": f"{pid}:{trial['trial']}:{obs['position']}",
                        "pair": obs["pair"],
                        "reserved": trial["reserved"],
                        "warm": bool(history),
                        "count": totals.count,
                        "pairCount": pair.count,
                        "pairSum": pair.log_sum,
                        "user": user,
                        "prompt": prompt_hash,
                        "speedBand": trial.get("speedBand", "unknown"),
                    }
                )
        if not trial["reserved"]:
            history.append(trial["observations"])
            del history[:-HISTORY_SENTENCES]
    x = csr_matrix((data, indices, indptr), shape=(len(targets), len(NAMES)))
    return DesignMatrix(x, np.array(targets), info)
