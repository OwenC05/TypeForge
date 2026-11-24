"""Stream the Aalto ZIP into split-specific NPZ shards. All output is private."""

import argparse
import csv
import hashlib
import io
import json
import math
import re
import tempfile
import zipfile
from collections import Counter
from dataclasses import dataclass, field
from operator import itemgetter
from pathlib import Path

import numpy as np


SCHEMA = 1
BLOCK = 256
PREFIX = "Keystrokes/files/"
PARTICIPANT = re.compile(r"Keystrokes/files/([0-9]+)_keystrokes[.]txt")
DEV = ("train", "validation")
COLUMNS = ("PARTICIPANT_ID", "TEST_SECTION_ID", "SENTENCE", "USER_INPUT",
           "KEYSTROKE_ID", "PRESS_TIME", "RELEASE_TIME", "LETTER", "KEYCODE")
PERCENTILES = (10, 25, 50, 75, 90, 99)


def sha_file(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def write_json(path, value):
    path.write_bytes((json.dumps(value, indent=2, sort_keys=True, allow_nan=False) + "\n").encode())


def split_ids(all_ids, prior, seed):
    if not prior <= all_ids:
        raise ValueError("Prior participants missing from the full archive")

    def rank(ids, salt):
        return sorted(ids, key=lambda pid: (hashlib.sha256(f"{salt}:split:{pid}".encode()).digest(), pid))

    fresh = rank(all_ids - prior, "fresh-2026-11")
    n = len(fresh) // 10
    # The historic pipeline's top 15% remains locked under common.md.
    old = rank(prior, seed)
    cutoff = int(len(old) * .85)
    return {name: sorted(ids) for name, ids in {
        "train": fresh[2*n:] + old[:cutoff], "validation": fresh[n:2*n],
        "test": fresh[:n], "legacy_test": old[cutoff:],
    }.items()}


class BadMember(ValueError):
    """An exclusion applied to the entire participant."""


def tsv(stream, columns, defaults):
    """Same BOM, newlines, quoting, blank records and row-width checks as pipeline.tsv."""
    with io.TextIOWrapper(stream, encoding="utf-8-sig", newline="") as text:
        reader = csv.reader(text, delimiter="\t", quoting=csv.QUOTE_NONE)
        header = next(reader, [])
        direct = tuple(header) == columns
        for row in reader:
            if not row:
                continue
            if len(row) != len(header):
                raise BadMember("malformed_tsv_participant")
            if direct:
                yield row
            else:
                # DictReader uses the last occurrence of a duplicate field.
                fields = defaults | dict(zip(header, row))
                yield tuple(fields[name] for name in columns)


@dataclass
class Trial:
    target: str
    final: str
    consistent: bool = True
    strokes: list = field(default_factory=list)


def parse_participant(raw, pid):
    # Materialize one participant before numeric validation, as in pipeline.audit.
    # A bad row rejects the whole file, even when it follows a valid trial.
    try:
        rows = list(tsv(io.BytesIO(raw), COLUMNS, {"RELEASE_TIME": ""}))
    except UnicodeDecodeError as exc:
        raise BadMember("invalid_utf8_participant") from exc
    trials = {}
    pid_mismatch = False
    for row_pid, section, target, final, stroke, press, release, letter, code in rows:
        try:
            press_ms, stroke_id, keycode = float(press), float(stroke), int(code)
        except (ValueError, OverflowError) as exc:
            raise BadMember("invalid_numeric_participant") from exc
        # Release is an additional field. V1 never rejects a row on this basis.
        try:
            release_ms = float(release)
        except (ValueError, OverflowError):
            release_ms = math.nan
        pid_mismatch |= row_pid != pid
        trial = trials.get(section)
        if trial is None:
            trial = trials[section] = Trial(target, final)
        elif target != trial.target or final != trial.final:
            trial.consistent = False
        trial.strokes.append((press_ms, stroke_id, release_ms, keycode, letter))
    if pid_mismatch:
        raise ValueError("Participant member mismatch")
    return trials


def eligibility(trial):
    """Count v1 observations and preserve pipeline.audit's first exclusion reason."""
    rows = sorted(trial.strokes, key=itemgetter(0, 1))
    if any(not math.isfinite(r[0]) for r in rows):
        return "nonfinite_time", 0
    if not trial.consistent or trial.final != trial.target:
        return "not_exact_final_copy", 0
    typed = [r for r in rows if r[3] != 16]
    if any(len(r[4]) != 1 for r in typed):
        return "unreconstructable_edit_or_control", 0
    if "".join(r[4] for r in typed) != trial.target:
        return "not_first_pass_reconstructable", 0
    if any(b[0] <= a[0] for a, b in zip(typed, typed[1:])):
        return "nonincreasing_press_time", 0
    # Once reconstructed, two adjacent ASCII lowercase letters necessarily
    # belong to the same maximal [A-Za-z]+ word in pipeline.occurrences.
    pairs = sum("a" <= a[4] <= "z" and "a" <= b[4] <= "z" and 0 < b[0]-a[0] <= 5000
                for a, b in zip(typed, typed[1:]))
    return ("eligible_trial" if pairs else "no_eligible_pairs"), pairs


def read_metadata(raw, dev_ids):
    result = {}
    columns = ("PARTICIPANT_ID", "LAYOUT", "KEYBOARD_TYPE", "AVG_WPM_15")
    defaults = {"LAYOUT": "missing", "KEYBOARD_TYPE": "missing", "AVG_WPM_15": ""}
    for pid, layout, keyboard, wpm in tsv(io.BytesIO(raw), columns, defaults):
        speed = None
        if pid in dev_ids:
            try:
                value = float(wpm)
                if math.isfinite(value):
                    speed = value
            except (ValueError, OverflowError):
                pass
        result[pid] = (layout, keyboard, speed)
    return result


def speed_summary(values):
    return {
        "known": len(values),
        "percentiles": dict(zip(map(str, PERCENTILES), np.percentile(values, PERCENTILES).tolist()))
        if values else {},
        "atLeast": {str(n): sum(v >= n for v in values) for n in (100, 150, 180)},
    }


def json_array(value):
    payload = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()
    return np.frombuffer(payload, dtype="u1")


class Shard:
    def __init__(self):
        self.trials = []
        self.letters = {}
        self.people = []
        self.sections = []
        self.strokes = []
        self.times = []
        self.codes = []
        self.characters = []

    def add(self, participant_index, trials, layout, keyboard):
        for section, trial in trials.items():
            trial_index = len(self.trials)
            self.trials.append([participant_index, section, trial.target, trial.final,
                                layout, keyboard, trial.consistent])
            length = len(trial.strokes)
            self.people.extend([participant_index] * length)
            self.sections.extend([trial_index] * length)
            for press, stroke, release, code, letter in trial.strokes:
                self.strokes.append(stroke)
                self.times.extend((press, release))
                self.codes.append(code)
                self.characters.append(self.letters.setdefault(letter, len(self.letters)))

    def save(self, path):
        # A pair of event rows per original keystroke. Fix ZIP timestamps so a
        # rebuild yields identical bytes with the same NumPy and zlib versions.
        columns = {
            "participant_index": (self.people, "<u4"), "trial_index": (self.sections, "<u4"),
            "keystroke_id": (self.strokes, "<f8"), "keycode": (self.codes, "<i4"),
            "letter_index": (self.characters, "<u4"),
        }
        with zipfile.ZipFile(path, "w") as archive:
            def put(name, array):
                entry = zipfile.ZipInfo(name + ".npy")
                entry.compress_type = zipfile.ZIP_DEFLATED
                entry.compress_level = 1
                with archive.open(entry, "w", force_zip64=True) as stream:
                    np.save(stream, array, allow_pickle=False)

            for name, (values, dtype) in columns.items():
                put(name, np.repeat(np.asarray(values, dtype=dtype), 2))
            put("timestamp_ms", np.asarray(self.times, dtype="<f8"))
            put("is_press", np.tile(np.array([True, False]), len(self.strokes)))
            put("letters_json", json_array(list(self.letters)))
            put("trials_json", json_array(self.trials))
        return {"path": path.as_posix(), "sha256": sha_file(path), "trials": len(self.trials),
                "keystrokes": len(self.strokes)}


def physical_rows(raw):
    # Count source lines even if UTF-8, TSV width, or a number fails validation.
    lines = raw.count(b"\n") + raw.count(b"\r") - raw.count(b"\r\n")
    return max(0, lines + int(bool(raw) and not raw.endswith((b"\r", b"\n"))) - 1)


def ingest(archive_path, subset_path, output):
    repo = Path(__file__).resolve().parents[2]
    if output.resolve().is_relative_to(repo):
        raise ValueError("Choose a private output directory outside the repository")
    if output.exists():
        raise FileExistsError(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    archive_sha = sha_file(archive_path)
    prior = json.loads(subset_path.read_bytes())
    expected = {m["name"]: m for m in prior["members"]}
    prior_ids = {m[1] for name in expected if (m := PARTICIPANT.fullmatch(name))}
    if len(prior_ids) != prior["requestedParticipants"] or len(expected) != len(prior["members"]):
        raise ValueError("Prior acquisition manifest count mismatch")
    with zipfile.ZipFile(archive_path) as archive, tempfile.TemporaryDirectory(dir=output.parent) as tmp:
        stage = Path(tmp) / "ingest"
        stage.mkdir()
        members = archive.infolist()
        if len({m.filename for m in members}) != len(members):
            raise ValueError("Duplicate ZIP member name")
        entries = {match[1]: m for m in members if (match := PARTICIPANT.fullmatch(m.filename))}
        for name, m in expected.items():
            info = archive.getinfo(name)
            if (info.file_size, info.CRC) != (m["bytes"], m["crc32"]):
                raise ValueError("Prior acquisition member differs from this archive")

        def member_bytes(info):
            data = archive.read(info)  # One bounded member to EOF, including its CRC check.
            if info.filename in expected and hashlib.sha256(data).hexdigest() != expected[info.filename]["sha256"]:
                raise ValueError("Prior member SHA256 mismatch")
            return data

        ids = split_ids(set(entries), prior_ids, prior["seed"])
        split_manifest = {
            "archiveSha256": archive_sha, "priorManifestFileSha256": sha_file(subset_path),
            "priorParticipants": len(prior_ids),
            "rule": "Exclude prior IDs. Sort remaining IDs by SHA256 of UTF-8 fresh-2026-11:split:{pid}, "
                    "ties by lexical ID. First floor(n/10) test, next floor(n/10) validation, rest train. "
                    "Add prior train/validation to train. Keep prior test in legacy_test, using the original "
                    "seed:split:{pid} hash rank and floor(0.85*n) cutoff.",
            "priorSeed": prior["seed"], "listFormat": "UTF-8 source IDs sorted lexically, one per LF-terminated line",
            "splits": {},
        }
        for split, people in ids.items():
            directory = stage / split
            directory.mkdir()
            path = directory / "ids.txt"
            path.write_bytes("".join(pid + "\n" for pid in people).encode())
            split_manifest["splits"][split] = {"participants": len(people), "sha256": sha_file(path)}
        write_json(stage / "split-manifest.json", split_manifest)

        metadata_info = archive.getinfo(PREFIX + "metadata_participants.txt")
        meta = read_metadata(member_bytes(metadata_info), set(ids["train"]) | set(ids["validation"]))
        for info in members:
            if info == metadata_info or PARTICIPANT.fullmatch(info.filename):
                continue
            if info.filename in expected:
                member_bytes(info)
            else:
                with archive.open(info) as stream:
                    while stream.read(1024 * 1024):
                        pass

        shards = []
        stats = {}
        for split, people in ids.items():
            counts, invalid, layouts, keyboards, reasons = (Counter() for _ in range(5))
            speeds, eligible_speeds = [], []
            for start in range(0, len(people), BLOCK):
                shard = Shard()
                for index, pid in enumerate(people[start:start+BLOCK], start):
                    raw = member_bytes(entries[pid])
                    counts["sourceDataLines"] += physical_rows(raw)
                    layout, keyboard, speed = meta.get(pid, ("missing", "missing", None))
                    layouts[layout] += 1
                    keyboards[keyboard] += 1
                    supported = layout == "qwerty" and keyboard in ("full", "laptop")
                    counts["supportedParticipants"] += int(supported)
                    if speed is not None:
                        speeds.append(speed)
                    dev = split in DEV
                    if dev and not supported:
                        reasons["unsupported_layout_or_keyboard"] += 1
                    try:
                        trials = parse_participant(raw, pid)
                    except BadMember as exc:
                        invalid[str(exc)] += 1
                        if dev and supported:
                            reasons[str(exc)] += 1
                        continue
                    counts["parsedParticipants"] += 1
                    shard.add(index, trials, layout, keyboard)
                    if dev and supported:
                        count = 0
                        for trial in trials.values():
                            reason, pairs = eligibility(trial)
                            reasons[reason] += 1
                            count += pairs
                        counts["v1EligibleObservations"] += count
                        if count:
                            counts["v1EligibleParticipants"] += 1
                            if speed is not None:
                                eligible_speeds.append(speed)
                path = Path(split) / f"{start // BLOCK:04d}.npz"
                entry = shard.save(stage / path)
                entry["path"] = path.as_posix()
                shards.append(entry)
                counts["parsedKeystrokes"] += entry["keystrokes"]
                counts["parsedTrials"] += entry["trials"]
                if len(shards) % 32 == 0:
                    print(f"Finished {len(shards)} shards", flush=True)
            stats[split] = dict(counts=counts, invalid=invalid, layouts=layouts, keyboards=keyboards)
            if split in DEV:
                stats[split].update(v1=reasons, wpm=speed_summary(speeds), eligibleWpm=speed_summary(eligible_speeds))
        sizes = [m.file_size for m in entries.values()]
        inventory = {
            "membersCrcVerified": len(members), "participantFiles": len(entries), "metadataIds": len(meta),
            "memberBytes": {"allExpanded": sum(m.file_size for m in members), "participantExpanded": sum(sizes),
                            "min": min(sizes), "median": float(np.median(sizes)), "max": max(sizes)},
            "splits": stats,
        }
        write_json(stage / "inventory.json", inventory)
        write_json(stage / "manifest.json", {
            "schemaVersion": SCHEMA, "archiveSha256": archive_sha,
            "splitManifestSha256": sha_file(stage / "split-manifest.json"),
            "inventorySha256": sha_file(stage / "inventory.json"), "shards": shards,
        })
        stage.rename(output)
        print(f"Verified {len(members)} members, wrote {len(shards)} shards; manifest {sha_file(output/'manifest.json')}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("prior_manifest", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    ingest(args.archive, args.prior_manifest, args.output)
