"""Aalto eligibility v2 development audit. Print aggregate JSON; never write to the dataset."""

import argparse
import csv
import hashlib
import io
import json
import math
import statistics
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from ml.eligibility_v2 import Replay, eligible, replay_aalto

SEED = 42
BOOTSTRAPS = 2000
TOLERANCE_PCT = 2
MANIFEST_SHA = "09c09772aad022efdb1c88427db22f46de4b39149e6cb930b5581453f14d5c86"
BANDS = ("<40", "40-80", "80-120", "120+")
BUCKETS = ("1", "2", "3", "4", "5-9", "10+", "none")
LOWER_EDGES = np.array([1, 2, 3, 4, 5, 10, np.inf])
WINDOWS = (0, 1, 2, 3, 4, 9)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def tsv(data):
    with io.TextIOWrapper(io.BytesIO(data), encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE):
            if None in row or None in row.values():
                raise ValueError("malformed TSV row")
            yield row


def speed_band(meta):
    try:
        wpm = float(meta["AVG_WPM_15"])
    except (KeyError, ValueError):
        return "unknown"
    if not math.isfinite(wpm) or wpm < 0:
        return "unknown"
    return BANDS[sum(wpm >= edge for edge in (40, 80, 120))]


def probe_counts(rows):
    """Reproduce v1 and both salvage-probe counts from raw dev rows, without rows.json."""
    rows = sorted(rows, key=lambda r: (float(r["PRESS_TIME"]), float(r["KEYSTROKE_ID"])))
    target, final = rows[0]["SENTENCE"], rows[0]["USER_INPUT"]
    v1 = all(r["SENTENCE"] == target and r["USER_INPUT"] == target
             and math.isfinite(float(r["PRESS_TIME"])) for r in rows)
    buf = ""
    previous_clean = False
    last = None
    count = guarded = 0
    since_delete = None
    for r in rows:
        code, ch, time = int(r["KEYCODE"]), r["LETTER"], float(r["PRESS_TIME"])
        if code == 16:
            continue
        if last is not None and time <= last:
            v1 = previous_clean = False
        if code == 8:
            v1 = previous_clean = False
            buf = buf[:-1]
            since_delete = 0
        elif len(ch) == 1:
            index = len(buf)
            buf += ch
            clean = target.startswith(buf)
            if (clean and previous_clean and "a" <= target[index - 1] <= "z"
                    and "a" <= ch <= "z" and 0 < time - last <= 5000):
                count += 1
                if since_delete is None or since_delete >= 2:
                    guarded += 1
            previous_clean = clean
            if since_delete is not None:
                since_delete += 1
        else:
            return 0, 0, 0
        last = time
    if buf != final:
        return 0, 0, 0
    return (count if v1 else 0), count, guarded


def bucket(distance):
    if distance is None:
        return 6
    if distance <= 4:
        return distance - 1
    return 4 if distance < 10 else 5


def grid():
    return np.zeros((7, 7))


@dataclass
class Typist:
    band: str
    v1: int = 0
    probe: int = 0
    probe_guarded: int = 0
    clean: int = 0
    reference: int = 0
    available: np.ndarray = field(default_factory=grid)
    matched: np.ndarray = field(default_factory=grid)
    log_sum: np.ndarray = field(default_factory=grid)
    diagnostics: dict = field(default_factory=lambda: defaultdict(list))


def score_person(person, pid, trials):
    # Independently balance clean and other sentences across two seeded folds.
    folds = [[], []]
    clean_trials = 0
    for clean in (True, False):
        group = [(key, tr) for key, tr in trials if tr.clean_copy == clean]
        group.sort(key=lambda item: sha(f"{SEED}:fold:{pid}:{item[0]}".encode()))
        if clean:
            clean_trials = len(group)
        for i, (_, trial) in enumerate(group):
            # When there is just one clean sentence, it can still score disjoint edited trials.
            fold = 1 if not clean and clean_trials == 1 else i % 2
            folds[fold].append(trial)
    for fit, score in ((folds[0], folds[1]), (folds[1], folds[0])):
        logs = defaultdict(list)
        for trial in fit:
            if trial.clean_copy:
                for m in trial.measurements:
                    logs[m.pair].append(math.log(m.ms))
        means = {pair: statistics.mean(values) for pair, values in logs.items()}
        for trial in score:
            for m in trial.measurements:
                coord = bucket(m.post), bucket(m.pre)
                extra = not trial.clean_copy and m.first and not m.error
                if extra:
                    person.available[coord] += 1
                if m.pair not in means:
                    continue
                residual = math.log(m.ms) - means[m.pair]
                if extra:
                    person.matched[coord] += 1
                    person.log_sum[coord] += residual
                if trial.clean_copy:
                    person.diagnostics["clean"].append(residual)
                elif m.error:
                    person.diagnostics["wrong"].append(residual)
                else:
                    if m.post is not None:
                        person.diagnostics["post/" + BUCKETS[coord[0]]].append(residual)
                    if m.next_disruption:
                        person.diagnostics[m.next_disruption + "/" + BUCKETS[coord[1]]].append(residual)


def collect(data):
    manifest_bytes = (data / "manifest.json").read_bytes()
    if sha(manifest_bytes) != MANIFEST_SHA:
        raise ValueError("expected the pinned 2,000-participant acquisition manifest")
    manifest = json.loads(manifest_bytes)
    members = {Path(m["name"]).name: m["sha256"] for m in manifest["members"]}
    pids = [name.split("_")[0] for name in members if name.endswith("_keystrokes.txt")]
    if len(set(pids)) != 2000 or manifest["seed"] != SEED:
        raise ValueError("unexpected split inputs")
    # Same ranking as pipeline.partition_participants; stop before opening any test member.
    ordered = sorted(pids, key=lambda pid: sha(f"{SEED}:split:{pid}".encode()))
    dev = ordered[:int(0.85 * len(ordered))]
    dev_set = set(dev)
    digests = {}

    def read_member(name):
        raw = (data / "raw" / name).read_bytes()
        digest = sha(raw)
        if digest != members[name]:
            raise ValueError("raw member does not match the manifest")
        digests[name] = digest
        return raw

    meta_name = "metadata_participants.txt"
    metadata = {r["PARTICIPANT_ID"]: r for r in tsv(read_member(meta_name))
                if r["PARTICIPANT_ID"] in dev_set}
    people = []
    outcomes = Counter()
    rejected_v1 = Counter()
    participants = Counter()
    for pid in dev:
        meta = metadata.get(pid, {})
        if meta.get("LAYOUT") != "qwerty" or meta.get("KEYBOARD_TYPE") not in ("full", "laptop"):
            participants["unsupported_layout_or_keyboard"] += 1
            continue
        raw = read_member(pid + "_keystrokes.txt")
        try:
            sections = defaultdict(list)
            for r in tsv(raw):
                # The historical probe dropped a whole member for unparseable numeric fields.
                float(r["PRESS_TIME"])
                float(r["KEYSTROKE_ID"])
                int(r["KEYCODE"])
                sections[r["TEST_SECTION_ID"]].append(r)
        except (UnicodeDecodeError, ValueError, OverflowError):
            participants["unreadable"] += 1
            continue
        person = Typist(speed_band(meta))
        trials: list[tuple[str, Replay]] = []
        for section, rows in sections.items():
            if any(r["PARTICIPANT_ID"] != pid for r in rows):
                raise ValueError("participant member mismatch")
            old, unguarded, guarded = probe_counts(rows)
            person.v1 += old
            person.probe += unguarded
            person.probe_guarded += guarded
            trial = replay_aalto(rows, layout=meta["LAYOUT"], keyboard_type=meta["KEYBOARD_TYPE"])
            outcomes[trial.reason or ("clean" if trial.clean_copy else "nonclean")] += 1
            if trial.reason:
                if old:
                    rejected_v1[trial.reason] += old
                continue
            if trial.clean_copy:
                person.clean += len(trial.measurements)
            person.reference += len(eligible(trial)["intervals"])
            if trial.measurements:
                trials.append((section, trial))
        score_person(person, pid, trials)
        people.append(person)
    # Hash names and verified byte hashes. The published digest contains no IDs.
    member_list = "".join(f"{key}\t{digests[key]}\n" for key in sorted(digests) if key != meta_name)
    return people, {
        "seed": SEED, "train": int(len(ordered) * .7), "validation": len(dev) - int(len(ordered) * .7),
        "testFilesOpened": 0, "devKeystrokeFilesRead": len(digests) - 1,
        "manifestSha256": MANIFEST_SHA, "metadataSha256": digests[meta_name],
        "devMemberListSha256": sha(member_list.encode()), "skippedParticipants": dict(participants),
        "trialReplay": dict(outcomes), "v1IntervalsRejectedBySourceAudit": dict(rejected_v1),
    }


def estimate(counts, sums):
    counts, sums = np.asarray(counts), np.asarray(sums)
    present = counts > 0
    values = sums[present] / counts[present]
    n = len(values)
    point = 100 * math.expm1(np.mean(values)) if n >= 2 else None
    ci = None
    if n >= 2:
        rng = np.random.default_rng(SEED)
        replicates = np.empty(BOOTSTRAPS)
        for start in range(0, BOOTSTRAPS, 100):
            indices = rng.integers(n, size=(100, n))
            replicates[start:start + 100] = values[indices].mean(axis=1)
        ci = (100 * np.expm1(np.quantile(replicates, [.025, .975]))).tolist()
    return {"typists": n, "intervals": int(counts.sum()), "pct": point, "ci95": ci}


def equivalent(effect):
    ci = effect["ci95"]
    return ci is not None and ci[0] >= -TOLERANCE_PCT and ci[1] <= TOLERANCE_PCT


def rounded(effect):
    return {**effect, "pct": round(effect["pct"], 3) if effect["pct"] is not None else None,
            "ci95": [round(x, 3) for x in effect["ci95"]] if effect["ci95"] else None}


def groups(people):
    bands = list(BANDS)
    if any(p.band == "unknown" for p in people):
        bands.append("unknown")
    return {"all": np.ones(len(people), dtype=bool),
            **{band: np.array([p.band == band for p in people]) for band in bands}}


def window_search(people):
    available, matched, totals = (np.stack([getattr(p, attr) for p in people])
                                  for attr in ("available", "matched", "log_sum"))
    strata = groups(people)
    best = None
    best_yield = 0
    passed_all = passed_pooled = 0
    far = {}
    pooled_candidates = []
    for post in WINDOWS:
        for pre in WINDOWS:
            mask = (LOWER_EDGES[:, None] > post) & (LOWER_EDGES[None, :] > pre)
            kept = available[:, mask].sum(axis=1)
            counts = matched[:, mask].sum(axis=1)
            sums = totals[:, mask].sum(axis=1)
            pooled = estimate(counts, sums)
            passes = equivalent(pooled)
            passed_pooled += passes
            most_guarded = (post, pre) == (9, 9)
            if not passes and not most_guarded:
                continue
            checks = {"all": rounded(pooled)}
            failures = []
            for band, members in strata.items():
                if band == "all" or not kept[members].any():
                    continue
                effect = estimate(counts[members], sums[members])
                checks[band] = rounded(effect)
                if not equivalent(effect):
                    failures.append(band)
            for axis, prefix in enumerate(("post", "pre")):
                for i, name in enumerate(BUCKETS):
                    cell = mask.copy()
                    if axis == 0:
                        cell[np.arange(7) != i, :] = False
                    else:
                        cell[:, np.arange(7) != i] = False
                    if not available[:, cell].any():
                        continue
                    effect = estimate(matched[:, cell].sum(axis=1), totals[:, cell].sum(axis=1))
                    checks[f"{prefix}/{name}"] = rounded(effect)
                    if not equivalent(effect):
                        failures.append(f"{prefix}/{name}")
            if most_guarded:
                far = {"extraIntervals": int(kept.sum()), "effects": checks}
            if passes:
                pooled_candidates.append({"post": post, "pre": pre, "effect": rounded(pooled),
                                          "failedStrata": failures})
            passes = passes and not failures
            if passes:
                passed_all += 1
                if kept.sum() > best_yield:
                    best, best_yield = (post, pre), int(kept.sum())
    return best, {"windowsPerSide": WINDOWS, "tolerancePct": TOLERANCE_PCT,
                  "tested": len(WINDOWS) ** 2, "passedPooled": passed_pooled,
                  "passedAll": passed_all, "selectedPostPre": best,
                  "pooledCandidates": pooled_candidates, "nineEachSide": far}


def analyze(data):
    people, inputs = collect(data)
    selected, search = window_search(people)
    bands = groups(people)
    effects = {}
    labels = ["clean", "wrong", *(f"{d}/{b}" for d in ("post", "error", "delete") for b in BUCKETS[:-1])]
    for label in labels:
        cells = [p.diagnostics.get(label, ()) for p in people]
        counts = np.array([len(c) for c in cells])
        sums = np.array([sum(c) for c in cells])
        effects[label] = {band: rounded(estimate(counts[g], sums[g])) for band, g in bands.items()}
    final = np.array([p.clean for p in people])
    if selected is not None:
        post, pre = selected
        mask = (LOWER_EDGES[:, None] > post) & (LOWER_EDGES[None, :] > pre)
        final += np.array([int(p.available[mask].sum()) for p in people])
    if selected is not None or not np.array_equal(final, [p.reference for p in people]):
        raise ValueError(f"reference disagrees with the development selection {selected}")
    yields = {}
    population = np.array([bool(p.v1 or p.probe) for p in people])
    for band, members in bands.items():
        members = members & population
        ys = {}
        for label, counts in (("v1", [p.v1 for p in people]), ("probeRaw", [p.probe for p in people]),
                              ("probeOnePost", [p.probe_guarded for p in people]),
                              ("v2", final)):
            xs = np.asarray(counts)[members]
            ys[label] = {"intervals": int(xs.sum()), "any": int((xs > 0).sum()),
                         "median": float(np.median(xs)) if len(xs) else None,
                         "atLeast200": int((xs >= 200).sum())}
        yields[band] = {"typists": int(members.sum()), **ys}
    coverage = {"extraIntervalsBeforeWindows": int(sum(p.available.sum() for p in people)),
                "matchedToCleanPair": int(sum(p.matched.sum() for p in people)),
                "typistsWithMatch": sum(bool(p.matched.any()) for p in people)}
    return {"inputs": inputs, "bootstrapReplicates": BOOTSTRAPS, "referenceCoverage": coverage, "effects": effects,
            "windowSearch": search, "yield": yields}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("data", type=Path, help="read-only ml/data directory of the pinned acquisition")
    print(json.dumps(analyze(parser.parse_args().data), indent=2, allow_nan=False))
