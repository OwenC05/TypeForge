"""Metric v2. The press/ID ordering, ASCII pair test and 5 s cap mirror pipeline.py."""

from bisect import bisect_right
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from math import isfinite
from sys import float_info
from typing import NotRequired, TypedDict

METRIC_VERSION = 2


class Event(TypedDict):
    kind: str
    t: float
    text: NotRequired[str]
    repeat: NotRequired[bool]
    start: NotRequired[int]
    end: NotRequired[int]


class Interval(TypedDict):
    pair: str
    fromIndex: int
    toIndex: int
    ms: float


class Result(TypedDict):
    reason: str | None
    intervals: list[Interval]


@dataclass(frozen=True, slots=True)
class Measurement:
    """One timed target pair. Errors and retyped positions are diagnostics only."""

    pair: str
    end: int
    ms: float
    first: bool
    error: bool
    post: int | None                # first interval after a Backspace = 1
    pre: int | None                 # immediate next key is the disruption = 1
    next_disruption: str | None    # 'error' or 'delete'


@dataclass(frozen=True, slots=True)
class Replay:
    reason: str | None
    clean_copy: bool = False
    measurements: tuple[Measurement, ...] = ()


def replay(target: str, events: Sequence[Event], final: str, *,
           submitted: bool = True, qwerty: bool = True) -> Replay:
    """Audit a neutral stream. Discard all provisional observations on a failed gate."""
    if not submitted:
        return Replay("unfinished")
    if not qwerty:
        return Replay("unsupported-layout")
    if not isinstance(target, str) or not target or not isinstance(final, str):
        return Replay("invalid-trial")
    buffer = ""
    high_water = 0  # tail-only edits: every position below this has been attempted
    previous_clean = previous_first = False
    previous_time = last_event_time = -1.0
    last_delete = None
    index = -1
    disruptions: list[int] = []
    kinds: list[str] = []
    pending: list[tuple[int, str, int, float, bool, bool, int | None]] = []
    for event in events:
        time, kind = event.get("t"), event.get("kind")
        if type(time) not in (int, float) or not 0 <= time <= float_info.max:
            return Replay("invalid-time")
        time = float(time)  # same binary64 key times as the browser
        if time < last_event_time:
            return Replay("invalid-time")
        last_event_time = time
        if kind == "shift":
            continue
        if time == previous_time:
            return Replay("invalid-time")
        index += 1
        if event.get("repeat"):
            return Replay("repeat")
        if kind == "deleteBackward":
            buffer = buffer[:-1]
            disruptions.append(index)
            kinds.append("delete")
            last_delete = index
            previous_clean = False
        elif kind == "insert":
            char = event.get("text", "")
            if not isinstance(char, str) or len(char) != 1 or not char.isprintable():
                return Replay("untracked-input")
            end = len(buffer)
            first = end == high_water
            prefix = target.startswith(buffer)
            correct = prefix and target[end:end + 1] == char
            if prefix and not correct:
                disruptions.append(index)
                kinds.append("error")
            pair = target[max(0, end - 1):end + 1]
            delta = time - previous_time
            if (previous_clean and len(pair) == 2 and all("a" <= ch <= "z" for ch in pair)
                    and 0 < delta <= 5000):
                post = None if last_delete is None else index - last_delete - 1
                pending.append((index, pair, end, delta, previous_first and first, not correct, post))
            buffer += char
            high_water = max(high_water, len(buffer))
            previous_clean, previous_first = correct, first
        elif kind in ("moveCursor", "replaceSelection", "deleteWordBackward", "deleteForward", "modifier"):
            return Replay("unsupported-edit")
        else:
            return Replay("untracked-input")
        previous_time = time
    if buffer != final:
        return Replay("final-mismatch")
    measurements = []
    for index, pair, end, ms, first, error, post in pending:
        after = bisect_right(disruptions, index)
        pre = disruptions[after] - index if after < len(disruptions) else None
        kind = kinds[after] if pre is not None else None
        measurements.append(Measurement(pair, end, ms, first, error, post, pre, kind))
    return Replay(None, not disruptions and final == target, tuple(measurements))


def eligible(trial: Replay) -> Result:
    """Emit v2 intervals once the sentence is closed and its replay reconciles."""
    if trial.reason:
        return {"reason": trial.reason, "intervals": []}
    if not trial.clean_copy:
        return {"reason": "clean-copy-required", "intervals": []}
    return {"reason": None, "intervals": [
        {"fromIndex": m.end - 1, "toIndex": m.end, "pair": m.pair, "ms": m.ms}
        for m in trial.measurements
    ]}


def replay_aalto(rows: Sequence[Mapping[str, str]], *, layout: str, keyboard_type: str) -> Replay:
    """Adapt one participant/section from raw TSV rows, including the recorded final copy."""
    if layout != "qwerty" or keyboard_type not in ("full", "laptop"):
        return Replay("unsupported-layout")
    if not rows:
        return Replay("invalid-trial")
    try:
        first = rows[0]
        identity = ("PARTICIPANT_ID", "TEST_SECTION_ID", "SENTENCE", "USER_INPUT")
        ordered = []
        for row in rows:
            if any(row[key] != first[key] for key in identity):
                return Replay("invalid-trial")
            time, key_id = float(row["PRESS_TIME"]), int(row["KEYSTROKE_ID"])
            if not isfinite(time) or time < 0:
                return Replay("invalid-time")
            ordered.append((time, key_id, int(row["KEYCODE"]), row["LETTER"]))
    except (KeyError, TypeError, ValueError, OverflowError):
        return Replay("invalid-trial")
    if len({row[1] for row in ordered}) != len(ordered):
        return Replay("invalid-trial")
    events: list[Event] = []
    for time, _, code, letter in sorted(ordered):
        if code == 16:
            events.append({"t": time, "kind": "shift"})
        elif code == 8:
            events.append({"t": time, "kind": "deleteBackward"})
        elif code in (17, 18, 20, 91, 92, 93, 224):
            events.append({"t": time, "kind": "modifier"})
        elif code in (33, 34, 35, 36, 37, 38, 39, 40, 45, 46):
            return Replay("unsupported-edit")
        elif (code in (32, 59, 61, 173, 226) or 48 <= code <= 57 or 65 <= code <= 90
              or 96 <= code <= 111 or 186 <= code <= 192 or 219 <= code <= 222):
            events.append({"t": time, "kind": "insert", "text": letter})
        else:
            return Replay("untracked-input")
    return replay(first["SENTENCE"], events, first["USER_INPUT"])
