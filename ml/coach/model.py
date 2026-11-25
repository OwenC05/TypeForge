"""Fit pair-by-speed expectations and update a typist from counts and log-ms sums."""

from dataclasses import dataclass
from math import log
from statistics import NormalDist

import numpy as np

PAIRS = 26 * 26
MIN_COUNT = 2
GAP = log(1.10)
COACH_PROBABILITY = 0.95
COACH_Z = NormalDist().inv_cdf(COACH_PROBABILITY)
RANGE_Z = NormalDist().inv_cdf(0.90)
MARGIN = 0.02
FAST_CUT = 100.0
POOL = 20


@dataclass
class Cells:
    """Observed typist-pair cells in one block. Empty cells take no space."""

    who: np.ndarray
    pair: np.ndarray
    n: np.ndarray
    total: np.ndarray
    within_ss: np.ndarray

    def select(self, keep):
        return Cells(self.who[keep], self.pair[keep], self.n[keep], self.total[keep],
                     self.within_ss[keep])


def training_cells(who, pair, y, people):
    """Reduce ordered training rows in blocks so no people-by-676 matrix is needed."""
    if len(who) != len(pair) or len(who) != len(y) or not len(y):
        raise ValueError("Expected aligned, nonempty clean training intervals")
    if (who[1:] < who[:-1]).any() or who[0] < 0 or who[-1] >= people:
        raise ValueError("Training rows must be ordered by their split-local typist index")
    if pair.min() < 0 or pair.max() >= PAIRS or not np.isfinite(y).all():
        raise ValueError("Invalid training pair or log interval")
    blocks = []
    edges = np.searchsorted(who, np.arange(0, people + 1024, 1024))
    for start, end in zip(edges[:-1], edges[1:]):
        if start == end:
            continue
        ids = who[start:end].astype(np.int64) * PAIRS + pair[start:end]
        key, index, n = np.unique(ids, return_inverse=True, return_counts=True)
        values = y[start:end].astype(np.float64, copy=False)
        total = np.bincount(index, weights=values)
        within_ss = np.maximum(0, np.bincount(index, weights=values**2) - total**2 / n)
        blocks.append(Cells((key // PAIRS).astype(np.int32), (key % PAIRS).astype(np.int16),
                            n.astype(np.int32), total, within_ss))
    return blocks


@dataclass
class Speed:
    center: float
    low: float
    high: float
    population_pair: np.ndarray
    a: np.ndarray
    b: np.ndarray

    def expected(self, s):
        bound = np.clip(s, self.low, self.high)
        return self.a + self.b * (bound - self.center) + (s - bound)


def fit_speed(blocks, people):
    counts = np.zeros(people)
    n = np.zeros(PAIRS)
    total = np.zeros(PAIRS)
    for c in blocks:
        counts += np.bincount(c.who, weights=c.n, minlength=people)
        n += np.bincount(c.pair, weights=c.n, minlength=PAIRS)
        total += np.bincount(c.pair, weights=c.total, minlength=PAIRS)
    if not (counts >= 20).any():
        raise ValueError("Training speed support needs typists with at least 20 intervals")
    center = float(total.sum() / n.sum())
    population_pair = np.divide(total, n, out=np.full(PAIRS, center), where=n > 0)
    a = (total + POOL * center) / (n + POOL)

    def personal_offsets(anchors):
        sums = np.zeros(people)
        for c in blocks:
            sums += np.bincount(c.who, weights=c.total - c.n * anchors[c.pair], minlength=people)
        return sums / np.maximum(1, counts)

    # Remove differences in who typed each pair before estimating its speed slope.
    for _ in range(4):
        offsets = personal_offsets(a)
        adjusted = total.copy()
        for c in blocks:
            adjusted -= np.bincount(c.pair, weights=c.n * offsets[c.who], minlength=PAIRS)
        a = (adjusted + POOL * center) / (n + POOL)
        a += center - np.average(a, weights=n)
        a[n == 0] = center
    offsets = personal_offsets(a)
    low, high = np.quantile(offsets[counts >= 20], [0.01, 0.99])
    bounded = np.clip(offsets, low, high)
    # A common unit slope continues the user's level beyond either speed boundary.
    penalty = POOL * max(float(np.average(bounded**2, weights=counts)), 1e-8)
    xy = np.full(PAIRS, penalty)
    xx = np.full(PAIRS, penalty)
    for c in blocks:
        x = bounded[c.who]
        target = c.total - c.n * (a[c.pair] + offsets[c.who] - x)
        xy += np.bincount(c.pair, weights=x * target, minlength=PAIRS)
        xx += np.bincount(c.pair, weights=c.n * x**2, minlength=PAIRS)
    return Speed(center, center + low, center + high, population_pair, a, xy / xx), offsets


@dataclass
class Model:
    speed: Speed
    tau2: np.ndarray
    sigma2: np.ndarray


def fit(blocks, people):
    speed, offsets = fit_speed(blocks, people)
    within = np.zeros(PAIRS)
    df = np.zeros(PAIRS)
    squared = np.zeros(PAIRS)
    inverse_n = np.zeros(PAIRS)
    repeaters = np.zeros(PAIRS)
    bounded = np.clip(offsets, speed.low - speed.center, speed.high - speed.center)
    for c in blocks:
        within += np.bincount(c.pair, weights=c.within_ss, minlength=PAIRS)
        df += np.bincount(c.pair, weights=c.n - 1, minlength=PAIRS)
        repeat = c.n >= 2
        u, p, n = c.who[repeat], c.pair[repeat], c.n[repeat]
        mu = speed.a[p] + speed.b[p] * bounded[u] + (offsets[u] - bounded[u])
        squared += np.bincount(p, weights=(c.total[repeat] / n - mu)**2, minlength=PAIRS)
        inverse_n += np.bincount(p, weights=1 / n, minlength=PAIRS)
        repeaters += np.bincount(p, minlength=PAIRS)
    if not df.sum():
        raise ValueError("Estimating personal gap variance requires repeated training pairs")
    sigma2 = np.maximum((within + POOL * within.sum() / df.sum()) / (df + POOL), 1e-6)
    signal = squared - sigma2 * inverse_n
    pooled = max(signal.sum() / repeaters.sum(), 0.05**2)
    tau2 = np.maximum((signal + POOL * pooled) / (repeaters + POOL), 0.05**2)
    return Model(speed, tau2, sigma2)


@dataclass
class Personal:
    speed: float
    own_mean: float
    expected: np.ndarray
    gap: np.ndarray
    variance: np.ndarray

    @property
    def prediction(self):
        return self.expected + self.gap


def update(model, n, total):
    """Recompute from per-pair counts and log sums after each eligible sentence."""
    count = n.sum()
    own_mean = total.sum() / count if count else model.speed.center
    offset = (total.sum() - np.dot(n, model.speed.a)) / count if count else 0.0
    speed = model.speed.center + offset
    expected = model.speed.expected(speed)
    denominator = model.sigma2 + n * model.tau2
    gap = model.tau2 * (total - n * expected) / denominator
    variance = model.tau2 * model.sigma2 / denominator
    return Personal(float(speed), float(own_mean), expected, gap, variance)


def suggestion(state, model, n, frequency):
    """One actionable pair. Frequency is per 1,000 characters, zero outside the bank."""
    passes = (n >= MIN_COUNT) & (frequency > 0)
    passes &= state.gap - COACH_Z * np.sqrt(state.variance) > GAP
    choices = np.flatnonzero(passes)
    if not len(choices):
        return None
    interval = np.exp(state.expected[choices] + 0.5 * model.sigma2[choices])
    lost = frequency[choices] * interval * np.expm1(state.gap[choices])
    return int(choices[np.argmax(lost)])
