"""Read Aalto TSVs and retain v1 first-pass, within-word keydown intervals."""

import csv
import math
import re
from collections.abc import Iterator, Sequence
from itertools import pairwise
from pathlib import Path
from typing import NamedTuple, TypedDict

from .config import MAX_INTERVAL_MS

type Event = dict[str, str]


class Occurrence(NamedTuple):
    """Second-letter offset in the prompt, pair, ASCII word length and relative offset."""

    position: int
    pair: str
    length: int
    relative: float


class HistoryPair(TypedDict):
    """Lowercase pair and natural-log milliseconds retained for calibration."""

    pair: str
    log: float


class Observation(HistoryPair):
    """One timed occurrence, with its source position and positive millisecond interval."""

    position: int
    length: int
    relative: float
    ms: float


def tsv(path: Path) -> Iterator[Event]:
    """Read literal tab-separated fields with optional BOM. Reject wrong-width rows."""
    with path.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source, delimiter="\t", quoting=csv.QUOTE_NONE)
        for row in reader:
            if None in row or any(value is None for value in row.values()):
                raise ValueError(f"Truncated or oversized TSV row in {path.name}")
            yield row


def occurrences(prompt: str) -> list[Occurrence]:
    """Find adjacent lowercase pairs in ASCII words. Relative position is in (0, 1]."""
    result = []
    for match in re.finditer(r"[A-Za-z]+", prompt):
        word = match.group()
        for offset in range(1, len(word)):
            pair = word[offset - 1 : offset + 1]
            if re.fullmatch("[a-z]{2}", pair):
                result.append(
                    Occurrence(match.start() + offset, pair, len(word), offset / (len(word) - 1))
                )
    return result


def observations(prompt: str, rows: Sequence[Event]) -> list[Observation]:
    """Ignore SHIFT and require an exact copy. Keep finite gaps in (0, 5000] ms."""
    typed = [row for row in rows if int(row["KEYCODE"]) != 16]
    if "".join(row["LETTER"] for row in typed) != prompt:
        return []
    return _intervals(prompt, typed)


def _intervals(prompt: str, typed: Sequence[Event]) -> list[Observation]:
    result: list[Observation] = []
    for position, pair, length, relative in occurrences(prompt):
        delta = float(typed[position]["PRESS_TIME"]) - float(typed[position - 1]["PRESS_TIME"])
        if math.isfinite(delta) and 0 < delta <= MAX_INTERVAL_MS:
            result.append(
                {
                    "position": position,
                    "pair": pair,
                    "length": length,
                    "relative": relative,
                    "ms": delta,
                    "log": math.log(delta),
                }
            )
    return result


def trial_observations(prompt: str, rows: Sequence[Event]) -> tuple[str, list[Observation]]:
    """Classify a chronological trial, returning its first exclusion or all eligible pairs."""
    if any(not math.isfinite(float(row["PRESS_TIME"])) for row in rows):
        return "nonfinite_time", []
    if any(row["SENTENCE"] != prompt or row["USER_INPUT"] != prompt for row in rows):
        return "not_exact_final_copy", []
    typed = [row for row in rows if int(row["KEYCODE"]) != 16]
    if any(len(row["LETTER"]) != 1 for row in typed):
        return "unreconstructable_edit_or_control", []
    if "".join(row["LETTER"] for row in typed) != prompt:
        return "not_first_pass_reconstructable", []
    times = [float(row["PRESS_TIME"]) for row in typed]
    if any(later <= earlier for earlier, later in pairwise(times)):
        return "nonincreasing_press_time", []
    result = _intervals(prompt, typed)
    return ("eligible_trial" if result else "no_eligible_pairs"), result
