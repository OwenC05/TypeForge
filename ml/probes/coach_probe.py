"""Read-only planning probe. Descriptive statistics on train+validation participants only.

Never touches the locked test split. Writes nothing into the repository.
Usage: python -I coach_probe.py <path-to-rows.json>
"""
import json
import math
import sys
from collections import defaultdict

import statistics as _st


class np:  # stdlib stand-in so the probe runs under `python -I` (no site-packages)
    mean = staticmethod(lambda xs: _st.fmean(xs))
    median = staticmethod(lambda xs: _st.median(xs))
    var = staticmethod(lambda xs: _st.pvariance(xs))

    @staticmethod
    def percentile(xs, q):
        ys = sorted(xs); k = (len(ys) - 1) * q / 100; lo = int(k); hi = min(lo + 1, len(ys) - 1)
        return ys[lo] + (ys[hi] - ys[lo]) * (k - lo)

    @staticmethod
    def array(xs):
        return list(xs)


def share(xs, threshold):
    return sum(x >= threshold for x in xs) / len(xs)


def corr(a, b):
    return _st.correlation(a, b)

rows = json.load(open(sys.argv[1], encoding="utf-8"))
dev = [r for r in rows if r["split"] in ("train", "validation") and not r["reserved"]]
print(f"trials: all={len(rows)} dev-nonreserved={len(dev)}")

# per participant: ordered trials -> list of (pair, log)
by_pid = defaultdict(list)
for r in dev:
    by_pid[(r["split"], r["pid"])].append([(o["pair"], o["log"]) for o in r["observations"]])
print(f"participants: train={sum(1 for k in by_pid if k[0]=='train')} validation={sum(1 for k in by_pid if k[0]=='validation')}")
obs_per = np.array([sum(len(t) for t in ts) for ts in by_pid.values()])
tr_per = np.array([len(ts) for ts in by_pid.values()])
print(f"per participant: trials median={np.median(tr_per):.0f} p90={np.percentile(tr_per,90):.0f} max={max(tr_per)}; intervals median={np.median(obs_per):.0f} p90={np.percentile(obs_per,90):.0f}")

LOG125 = math.log(1.25)
COACHABLE = ["he", "in", "le", "th"]


def contrast(trials, pair):
    t = [l for tr in trials for p, l in tr if p == pair]
    ref = [l for tr in trials for p, l in tr if p != pair]
    if not t or not ref:
        return None
    return len(t), len(ref), float(np.mean(t) - np.mean(ref))


print("\n=== A. Shipped rule 'target >= 1.25x the user's other pairs' on real typists ===")
for min_t in (5, 8, 12):
    print(f"-- support: >= {min_t} target intervals and >= 40 reference intervals")
    any_fire = 0
    eligible_any = 0
    for pair in COACHABLE:
        deltas = []
        for trials in by_pid.values():
            c = contrast(trials, pair)
            if c and c[0] >= min_t and c[1] >= 40:
                deltas.append(c[2])
        d = np.array(deltas)
        if len(d):
            print(f"   {pair}: n={len(d):4d}  median ratio={math.exp(np.median(d)):.2f}  p90={math.exp(np.percentile(d,90)):.2f}  p99={math.exp(np.percentile(d,99)):.2f}  >=1.25x: {share(d, LOG125)*100:5.2f}%  >=1.10x: {share(d, math.log(1.1))*100:5.2f}%")
    for trials in by_pid.values():
        cs = [contrast(trials, p) for p in COACHABLE]
        cs = [c for c in cs if c and c[0] >= min_t and c[1] >= 40]
        if cs:
            eligible_any += 1
            any_fire += any(c[2] >= LOG125 for c in cs)
    print(f"   participants with support on >=1 coachable pair: {eligible_any}; any of he/in/le/th >=1.25x: {any_fire} ({100*any_fire/max(1,eligible_any):.2f}%)")

print("\n=== B. Which pairs does an own-contrast rule flag, over ALL pairs? (typists with >=60 intervals; >=3 of the pair) ===")
flag = defaultdict(list)
for trials in by_pid.values():
    counts = defaultdict(list)
    for tr in trials:
        for p, l in tr:
            counts[p].append(l)
    total_n = sum(len(v) for v in counts.values())
    total_s = sum(sum(v) for v in counts.values())
    if total_n < 60:
        continue
    for p, v in counts.items():
        if len(v) >= 3:
            flag[p].append(np.mean(v) - (total_s - sum(v)) / (total_n - len(v)))
common = [(p, len(d), math.exp(np.median(d)), share(d, LOG125)) for p, d in flag.items() if len(d) >= 60]
common.sort(key=lambda x: -x[3])
print(f"   pairs with >=60 supported typists: {len(common)}")
print("   most-flagged pairs (pair: typists, median ratio to own other pairs, share at >=1.25x):")
for p, n, med, s in common[:12]:
    print(f"      {p}: {n:3d}  {med:.2f}x  {s*100:.0f}%")
print("   least-flagged pairs:")
for p, n, med, s in common[-8:]:
    print(f"      {p}: {n:3d}  {med:.2f}x  {s*100:.0f}%")
print(f"   flagged for >=50% of typists: {[p for p, _, _, s in common if s >= 0.5]}; flagged for <=10% of typists: {sum(1 for _, _, _, s in common if s <= 0.1)}")

print("\n=== C. Is there a stable PERSONAL pair signal beyond the population? (split-half, validation participants) ===")
# population pair effect from TRAIN participants: mean over participants of (pair mean log - user mean log)
eff = defaultdict(list)
for (split, _), trials in by_pid.items():
    if split != "train":
        continue
    allv = [l for tr in trials for _, l in tr]
    if len(allv) < 40:
        continue
    um = np.mean(allv)
    c = defaultdict(list)
    for tr in trials:
        for p, l in tr:
            c[p].append(l)
    for p, v in c.items():
        if len(v) >= 2:
            eff[p].append(np.mean(v) - um)
pop = {p: float(np.mean(v)) for p, v in eff.items() if len(v) >= 30}
print(f"   population pair effects estimated on train for {len(pop)} pairs (>=30 participants each)")

for min_cell in (2, 3, 4):
    own_a, own_b, res_a, res_b = [], [], [], []
    n_part = 0
    for (split, _), trials in by_pid.items():
        if split != "validation" or len(trials) < 4:
            continue
        halves = [trials[0::2], trials[1::2]]
        stats = []
        for h in halves:
            allv = [l for tr in h for _, l in tr]
            um = np.mean(allv)
            c = defaultdict(list)
            for tr in h:
                for p, l in tr:
                    c[p].append(l)
            stats.append((um, c))
        used = False
        for p in set(stats[0][1]) & set(stats[1][1]):
            if p not in pop:
                continue
            a, b = stats[0][1][p], stats[1][1][p]
            if len(a) >= min_cell and len(b) >= min_cell:
                oa, ob = np.mean(a) - stats[0][0], np.mean(b) - stats[1][0]
                own_a.append(oa); own_b.append(ob)
                res_a.append(oa - pop[p]); res_b.append(ob - pop[p])
                used = True
        n_part += used
    if len(own_a) > 30:
        r_own = corr(own_a, own_b)
        r_res = corr(res_a, res_b)
        sb = lambda r: 2 * r / (1 + r)
        print(f"   cells with >={min_cell} obs per half: {len(own_a)} (participant,pair) cells from {n_part} participants")
        print(f"      own-contrast split-half r = {r_own:.3f}  (includes shared pair difficulty)")
        print(f"      peer-adjusted residual split-half r = {r_res:.3f}  (personal signal only); Spearman-Brown full-length = {sb(r_res):.3f}")
        print(f"      share of own-contrast variance explained by population pair effect: {1 - np.var(res_a + res_b) / np.var(own_a + own_b):.2f}")
