"""Build chronological eligible trials and the aggregate audit from the verified raw cache."""

import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import NotRequired, TypedDict

from .acquire import Manifest
from .config import digest, read_json, write_json
from .parse import Event, Observation, trial_observations, tsv
from .split import SPLITS, Split, partition_participants, reserved


class Trial(TypedDict):
    """One eligible sentence with a participant split, prompt partition and ordered labels."""

    pid: str
    trial: str
    prompt: str
    speedBand: NotRequired[str]
    errorBand: NotRequired[str]
    reserved: bool
    split: Split
    observations: list[Observation]


def load_trials(data_dir: Path) -> list[Trial]:
    """Read audited trials in their original participant and sentence order."""
    return read_json(data_dir / "rows.json")


def _participant_events(path: Path) -> tuple[list[Event], str | None]:
    try:
        rows = list(tsv(path))
    except UnicodeDecodeError:
        return [], "invalid_utf8_participant"
    except ValueError:
        return [], "malformed_tsv_participant"
    try:
        for row in rows:
            float(row["PRESS_TIME"])
            float(row["KEYSTROKE_ID"])
            int(row["KEYCODE"])
    except (ValueError, OverflowError):
        return [], "invalid_numeric_participant"
    return rows, None


def _ordered_trials(rows: list[Event], pid: str) -> list[tuple[str, list[Event]]]:
    trials: dict[str, list[Event]] = defaultdict(list)
    for row in rows:
        if row["PARTICIPANT_ID"] != pid:
            raise ValueError("Participant member mismatch")
        trials[row["TEST_SECTION_ID"]].append(row)
    ordered = sorted(
        trials.items(), key=lambda item: (min(float(row["PRESS_TIME"]) for row in item[1]), item[0])
    )
    for _, events in ordered:
        events.sort(key=lambda row: (float(row["PRESS_TIME"]), float(row["KEYSTROKE_ID"])))
    return ordered


def _audit_bands(metadata: Event) -> tuple[str, str]:
    try:
        low = int(float(metadata.get("AVG_WPM_15", "unknown")) // 20) * 20
        speed = f"{low}-{low + 20}"
    except ValueError:
        speed = "unknown"
    try:
        error = "below-2-percent" if float(metadata["ERROR_RATE"]) < 2 else "2-percent-or-more"
    except (KeyError, ValueError):
        error = "unknown"
    return speed, error


def audit(data_dir: Path) -> None:
    """Check source hashes, apply participant and sentence exclusions, and write rows and counts."""
    manifest: Manifest = read_json(data_dir / "manifest.json")
    members = manifest["members"]
    raw = data_dir / "raw"
    metadata_path = raw / "metadata_participants.txt"
    metadata_member = next(m for m in members if m["name"].endswith("/metadata_participants.txt"))
    if digest(metadata_path.read_bytes()) != metadata_member["sha256"]:
        raise ValueError("Metadata cache hash mismatch")
    metadata = {row["PARTICIPANT_ID"]: row for row in tsv(metadata_path)}
    participants = [m for m in members if m["name"].endswith("_keystrokes.txt")]
    ids = [Path(m["name"]).name.split("_")[0] for m in participants]
    assignments = partition_participants(ids, manifest["seed"])

    records: list[Trial] = []
    reasons: Counter[str] = Counter()
    layouts: Counter[str] = Counter()
    coverage: dict[str, Counter[str]] = defaultdict(Counter)
    error_coverage: dict[str, Counter[str]] = defaultdict(Counter)
    for pid, member in zip(ids, participants):
        path = raw / Path(member["name"]).name
        if digest(path.read_bytes()) != member["sha256"]:
            raise ValueError("Cache hash mismatch")
        meta = metadata.get(pid, {})
        layouts[meta.get("LAYOUT", "missing")] += 1
        if meta.get("LAYOUT") != "qwerty" or meta.get("KEYBOARD_TYPE") not in ("full", "laptop"):
            reasons["unsupported_layout_or_keyboard"] += 1
            continue
        rows, exclusion = _participant_events(path)
        if exclusion:
            reasons[exclusion] += 1
            continue
        for trial, events in _ordered_trials(rows, pid):
            prompt = events[0]["SENTENCE"]
            reason, observations = trial_observations(prompt, events)
            speed, error = _audit_bands(meta)
            reasons[reason] += 1
            coverage[speed][reason] += 1
            error_coverage[error][reason] += 1
            if observations:
                records.append(
                    {
                        "pid": pid,
                        "trial": trial,
                        "prompt": prompt,
                        "speedBand": speed,
                        "errorBand": error,
                        "reserved": reserved(prompt),
                        "split": assignments[pid],
                        "observations": observations,
                    }
                )

    splits = {}
    for split in SPLITS:
        usable = [r for r in records if r["split"] == split and not r["reserved"]]
        if not usable:
            raise ValueError(f"Empty usable {split} split")
        splits[split] = {
            "participants": len({r["pid"] for r in usable}),
            "observations": sum(len(r["observations"]) for r in usable),
        }
    report = {
        "acquiredParticipants": manifest["requestedParticipants"],
        "eligibleParticipants": len({r["pid"] for r in records}),
        "eligibleTrials": len(records),
        "eligibleObservations": sum(len(r["observations"]) for r in records),
        "exclusions": dict(reasons),
        "exclusionUnits": {
            "unsupported_layout_or_keyboard": "participants",
            "invalid_utf8_participant": "participants",
            "malformed_tsv_participant": "participants",
            "invalid_numeric_participant": "participants",
            "all_other_reasons": "trials",
        },
        "layouts": dict(layouts),
        "speedStrata": dict(coverage),
        "errorStrata": dict(error_coverage),
        "rowsSha256": digest(records),
        "acquisitionSplits": dict(Counter(assignments.values())),
        "splits": splits,
    }
    write_json(data_dir / "rows.json", records)
    write_json(data_dir / "audit.json", report)
    print(json.dumps(report))
