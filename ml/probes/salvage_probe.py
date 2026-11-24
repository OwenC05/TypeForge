"""Read-only planning probe: how many clean intervals does sentence-level eligibility discard?

Replays each trial's keystrokes (with Backspace) and keeps an interval only when both keys were
typed correctly, in order, at the end of a correct prefix, with no key between them. A trial is
trusted only if the replay reproduces the recorded final USER_INPUT exactly.
Dev participants (train+validation) only. Writes nothing.
Usage: python -I salvage_probe.py <ml/data directory>
"""
import csv
import hashlib
import json
import statistics as st
import sys
from collections import Counter, defaultdict
from pathlib import Path

DATA = Path(sys.argv[1])
csv.field_size_limit(10_000_000)


def digest(b):
    return hashlib.sha256(b).hexdigest()


def tsv(path):
    with path.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE):
            if None in row or any(v is None for v in row.values()):
                raise ValueError("truncated row")
            yield row


manifest = json.loads((DATA / "manifest.json").read_text())
pids = [Path(m["name"]).name.split("_")[0] for m in manifest["members"] if m["name"].endswith("_keystrokes.txt")]
ordered = sorted(pids, key=lambda p: digest(f"{manifest['seed']}:split:{p}".encode()))
a, b = int(len(ordered) * 0.7), int(len(ordered) * 0.85)
split = {p: "train" if i < a else "validation" if i < b else "test" for i, p in enumerate(ordered)}
dev = [p for p in pids if split[p] != "test"]
meta = {r["PARTICIPANT_ID"]: r for r in tsv(DATA / "raw" / "metadata_participants.txt")}

current = defaultdict(int)  # pid -> currently eligible intervals (rows.json, incl. reserved prompts)
current_trials = defaultdict(int)
for r in json.loads((DATA / "rows.json").read_text(encoding="utf-8")):
    if split.get(r["pid"]) != "test":
        current[r["pid"]] += len(r["observations"])
        current_trials[r["pid"]] += 1

LOWER = set("abcdefghijklmnopqrstuvwxyz")
salv = defaultdict(int)       # all clean intervals
salv_cons = defaultdict(int)  # conservative: also drop the first interval after any correction
trials_with = defaultdict(int)
outcome = Counter()
controls = Counter()
skipped = Counter()

for pid in dev:
    m = meta.get(pid, {})
    if m.get("LAYOUT") != "qwerty" or m.get("KEYBOARD_TYPE") not in ("full", "laptop"):
        skipped["unsupported_layout_or_keyboard"] += 1
        continue
    try:
        rows = list(tsv(DATA / "raw" / f"{pid}_keystrokes.txt"))
        for r in rows:
            float(r["PRESS_TIME"]); float(r["KEYSTROKE_ID"]); int(r["KEYCODE"])
    except (UnicodeDecodeError, ValueError, OverflowError):
        skipped["unreadable_participant"] += 1
        continue
    trials = defaultdict(list)
    for r in rows:
        trials[r["TEST_SECTION_ID"]].append(r)
    for rows_t in trials.values():
        rows_t.sort(key=lambda r: (float(r["PRESS_TIME"]), float(r["KEYSTROKE_ID"])))
        prompt = rows_t[0]["SENTENCE"]
        final = rows_t[0]["USER_INPUT"]
        buf = []
        prev = None           # (position, time, chars_since_edit) of the previous key if it was clean
        since_edit = 10**6
        n_all = n_cons = 0
        trusted = True
        last_t = None
        for r in rows_t:
            kc, letter, t = int(r["KEYCODE"]), r["LETTER"], float(r["PRESS_TIME"])
            if kc == 16:
                continue
            if last_t is not None and t <= last_t:
                prev = None   # non-increasing clock: never bridge it
            last_t = t
            if kc == 8:
                if buf:
                    buf.pop()
                prev = None
                since_edit = 0
                continue
            if len(letter) != 1:
                controls[letter] += 1
                trusted = False
                break
            pos = len(buf)
            buf.append(letter)
            since_edit += 1
            clean = pos < len(prompt) and letter == prompt[pos] and "".join(buf[:pos]) == prompt[:pos]
            if clean and prev is not None and prev[0] == pos - 1:
                if prompt[pos - 1] in LOWER and prompt[pos] in LOWER and 0 < t - prev[1] <= 5000:
                    n_all += 1
                    if prev[2] >= 2:
                        n_cons += 1
            prev = (pos, t, since_edit) if clean else None
        if not trusted:
            outcome["untrusted_control_key"] += 1
            continue
        if "".join(buf) != final:
            outcome["replay_does_not_match_final_input"] += 1
            continue
        outcome["replay_verified"] += 1
        if n_all:
            trials_with[pid] += 1
        salv[pid] += n_all
        salv_cons[pid] += n_cons

print("skipped participants:", dict(skipped))
print("trial outcomes:", dict(outcome))
print("most common untrusted control labels:", controls.most_common(8))
tot_cur, tot_all, tot_cons = sum(current.values()), sum(salv.values()), sum(salv_cons.values())
print(f"\nclean intervals, dev participants: current sentence-level rule = {tot_cur}")
print(f"   interval-level rule = {tot_all}  ({tot_all / tot_cur:.2f}x)")
print(f"   interval-level, also dropping first interval after a correction = {tot_cons}  ({tot_cons / tot_cur:.2f}x)")
print(f"trials contributing: current = {sum(current_trials.values())}, interval-level = {sum(trials_with.values())}")
elig = [p for p in dev if salv.get(p, 0) or current.get(p, 0)]
print(f"participants with any interval: current = {sum(1 for p in dev if current.get(p))}, interval-level = {sum(1 for p in dev if salv.get(p))}")
for name, d in (("current", current), ("interval-level", salv), ("interval-level conservative", salv_cons)):
    xs = [d.get(p, 0) for p in elig]
    print(f"   per participant [{name}]: median={st.median(xs):.0f}  >=100 intervals: {sum(x >= 100 for x in xs)}  >=200: {sum(x >= 200 for x in xs)}  >=300: {sum(x >= 300 for x in xs)}")

print("\nby typing-speed band (participants with any data; median intervals per participant):")
bands = defaultdict(list)
for p in elig:
    try:
        w = float(meta[p]["AVG_WPM_15"])
        band = "0-40" if w < 40 else "40-60" if w < 60 else "60-80" if w < 80 else "80+"
    except (KeyError, ValueError):
        band = "unknown"
    bands[band].append(p)
for band in sorted(bands):
    ps = bands[band]
    c = [current.get(p, 0) for p in ps]
    s = [salv_cons.get(p, 0) for p in ps]
    print(f"   {band:>7}: n={len(ps):4d}  current median={st.median(c):5.0f} (zero for {sum(x == 0 for x in c)})  conservative interval-level median={st.median(s):5.0f} (zero for {sum(x == 0 for x in s)})  total gain={sum(s) / max(1, sum(c)):.2f}x")
