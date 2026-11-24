"""Print aggregate power tables from the frozen Aalto development subset."""

import argparse
from collections import defaultdict
from dataclasses import dataclass
import json
import math
from pathlib import Path
from statistics import fmean, variance

import numpy as np
from scipy.stats import t

from ml.pipeline import digest, observations, partition_participants, tsv


MANIFEST_SHA256 = "3a756f95c07305c99179bbf1679639e9ec111d5c8e5aa2235df403bac404c30e"
SEED = 20261124
TRIALS = 10_000
ALPHA = 0.05
COUNTS = (10, 20, 40)
INFLATIONS = (1, 1.5, 2)
EFFECTS = (0, 0.03, 0.05, 0.10)


def checked_path(data, member):
    path = data / "raw" / Path(member["name"]).name
    if digest(path.read_bytes()) != member["sha256"]:
        raise ValueError(f"Acquired bytes differ from the manifest: {path.name}")
    return path


def session_halves(path, pid):
    """Split all sentence trials in time order, then keep exact first-pass copies."""
    trials = defaultdict(list)
    try:
        for row in tsv(path):
            if row["PARTICIPANT_ID"] != pid:
                raise RuntimeError("Keystroke member contains another participant")
            for key in ("PRESS_TIME", "KEYSTROKE_ID"):
                row[key] = float(row[key])
                if not math.isfinite(row[key]):
                    return None
            row["KEYCODE"] = int(row["KEYCODE"])
            trials[row["TEST_SECTION_ID"]].append(row)
    except (ValueError, OverflowError):
        return None

    ordered = sorted(trials, key=lambda trial: (min(r["PRESS_TIME"] for r in trials[trial]), trial))
    halves = [defaultdict(list), defaultdict(list)]
    for index, trial in enumerate(ordered):
        rows = sorted(trials[trial], key=lambda r: (r["PRESS_TIME"], r["KEYSTROKE_ID"]))
        prompt = rows[0]["SENTENCE"]
        if any(r["SENTENCE"] != prompt or r["USER_INPUT"] != prompt for r in rows):
            continue
        typed = [r for r in rows if r["KEYCODE"] != 16]
        if any(len(r["LETTER"]) != 1 for r in typed):
            continue
        if any(b["PRESS_TIME"] <= a["PRESS_TIME"] for a, b in zip(typed, typed[1:])):
            continue
        half = halves[int(index >= len(ordered) // 2)]
        for obs in observations(prompt, rows):
            half[obs["pair"]].append(obs["log"])
    return halves


@dataclass
class Person:
    smaller_half_counts: list[int]
    mean_change: float
    mean_squared_change: float
    between_pair_variance: float
    sampling_variance: float
    within_half_variance: float


def measure_person(early, late):
    counts, changes, sampling, within = [], [], [], []
    for pair in sorted(early.keys() & late.keys()):
        a, b = early[pair], late[pair]
        if min(len(a), len(b)) < 2:
            continue
        counts.append(min(len(a), len(b)))
        va, vb = variance(a), variance(b)
        changes.append(fmean(b) - fmean(a))
        sampling.append(va / len(a) + vb / len(b))
        within.append((va + vb) / 2)
    if len(changes) < 2:
        return None
    return Person(counts, fmean(changes), fmean(x * x for x in changes),
                  variance(changes), fmean(sampling), fmean(within))


def calibrate(data):
    manifest = json.loads((data / "manifest.json").read_bytes())
    if digest(manifest) != MANIFEST_SHA256:
        raise ValueError("Expected the published seed-42, 2,000-participant manifest")
    members = {Path(m["name"]).name: m for m in manifest["members"]}
    files = {name.split("_")[0]: m for name, m in members.items() if name.endswith("_keystrokes.txt")}
    split = partition_participants(files, manifest["seed"])
    dev = {pid for pid in files if split[pid] in ("train", "validation")}
    metadata = checked_path(data, members["metadata_participants.txt"])
    physical = {r["PARTICIPANT_ID"] for r in tsv(metadata) if r["PARTICIPANT_ID"] in dev
                and r["LAYOUT"] == "qwerty" and r["KEYBOARD_TYPE"] in ("laptop", "full")}

    people = []
    for pid in sorted(physical):
        halves = session_halves(checked_path(data, files[pid]), pid)
        if halves is not None:
            person = measure_person(*halves)
            if person is not None:
                people.append(person)
    if not people:
        raise ValueError("No development participants have two repeated pairs in both halves")
    return people, len(physical)


def exact_power(differences):
    """Two-sided matched randomisation test, fixing one sign by symmetry."""
    sums = differences[:, :1]
    for column in range(1, differences.shape[1]):
        value = differences[:, column:column + 1]
        sums = np.concatenate((sums - value, sums + value), axis=1)
    # The last column preserves every observed label. Count ties as extreme.
    extreme = np.abs(sums) >= np.abs(sums[:, -1:]) - 1e-12
    return np.mean(extreme.mean(axis=1) <= ALPHA)


def simulate(people, floor):
    rng = np.random.default_rng(SEED)
    within = np.array([p.within_half_variance for p in people])
    group_sizes = (10, 15, 20, 30, 50)
    match_counts = (4, 6, 8)
    for solo, sizes in ((False, group_sizes), (True, match_counts)):
        header = "Owen's matched sets" if solo else "Volunteers"
        print(f"\n| {header} | Occurrences per pair per visit | 1× variance | 1.5× variance | 2× variance |")
        print("|---:|---:|---:|---:|---:|")
        nulls = []
        for size in sizes:
            # Owen has one noise profile across all matches. Each volunteer has their own.
            profiles = rng.choice(within, size=(TRIALS, 1 if solo else size))
            noise = rng.standard_normal((TRIALS, size))
            if not solo:
                critical = t.ppf(1 - ALPHA / 2, size - 1)
            for k in COUNTS:
                base = noise * np.sqrt(2 * (floor + 2 * profiles / k))
                cells = []
                for inflation in INFLATIONS:
                    sample = base * math.sqrt(inflation)
                    if not solo:
                        means = sample.mean(axis=1)
                        margin = critical * sample.std(axis=1, ddof=1) / math.sqrt(size)
                    powers = []
                    for effect in EFFECTS:
                        shift = math.log1p(-effect)
                        if solo:
                            power = exact_power(sample + shift)
                        else:
                            power = np.mean(np.abs(means + shift) > margin)
                        if effect:
                            powers.append(f"{100 * power:.0f}")
                        elif inflation == 1:
                            nulls.append(power)
                    cells.append(" / ".join(powers))
                print(f"| {size} | {k} | " + " | ".join(cells) + " |")
        if solo:
            # A common scale for all of one person's contrasts leaves the null test unchanged.
            rates = nulls[::len(COUNTS)]
            checks = ", ".join(f"{n} sets {100 * rate:.1f}%" for n, rate in zip(sizes, rates))
            print(f"\nZero-effect rejection rates for Owen were {checks}.")
        else:
            print(f"\nZero-effect rejection rates for volunteers ranged from "
                  f"{100 * min(nulls):.1f}% to {100 * max(nulls):.1f}%.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("data", type=Path, help="read-only acquired Aalto ml/data directory")
    people, physical = calibrate(parser.parse_args().data)
    observed = fmean(p.mean_squared_change for p in people) - fmean(p.mean_change for p in people)**2
    between = fmean(p.between_pair_variance for p in people)
    sampling = fmean(p.sampling_variance for p in people)
    floor = max(0.0, between - sampling)
    within = fmean(p.within_half_variance for p in people)
    counts = np.array([n for person in people for n in person.smaller_half_counts])
    print(f"Development had {physical:,} physical-QWERTY users. "
          f"{len(people):,} contributed {len(counts):,} repeated person–pair cells.")
    print(f"The median count in a cell’s smaller half was {np.median(counts):.0f}. "
          f"Cells reaching 10, 20 and 40 observations in both halves numbered "
          f"{sum(counts >= 10)}, {sum(counts >= 20)} and {sum(counts >= 40)}.")
    print(f"Observed variance of a single pair’s early-to-late change was {observed:.5f} squared log units. "
          f"Within typists, variance across pair changes was {between:.5f}, of which "
          f"{sampling:.5f} was estimated sampling variance. The fitted floor was {floor:.5f}.")
    print(f"Mean within-half interval variance was {within:.5f}.")
    simulate(people, floor)


if __name__ == "__main__":
    main()
