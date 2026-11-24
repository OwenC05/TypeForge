"""Synthetic inputs and expected predictions for browser/Python parity."""

import math
from typing import Any

from .baselines import baseline_log_ms
from .features import History, HistoryTotals, PairTotals, features, summary_history
from .parse import observations, occurrences


def parity_inputs() -> list[tuple[str, History]]:
    """Return the fixed cold and warm sentences used to capture fitted predictions."""
    return [
        ("cat can", []),
        (
            "aBcd can't cat",
            [[{"pair": "ca", "log": math.log(100)}, {"pair": "at", "log": math.log(300)}]],
        ),
    ]


def _history_json(totals: HistoryTotals) -> dict[str, Any]:
    return {
        "count": totals.count,
        "logSum": totals.log_sum,
        "pairs": {pair: {"count": n, "logSum": s} for pair, (n, s) in totals.pairs.items()},
    }


def parity_fixture(artifact: dict[str, Any], fitted_predictions: list[float]) -> dict[str, Any]:
    """Check folded predictions against the fitted estimator and serialize synthetic cases."""
    predictions = iter(fitted_predictions)
    cases = []
    population = artifact["populationMeanLogMs"]
    baseline = artifact["baseline"]
    for prompt, history in parity_inputs():
        totals = summary_history(history)
        rows = []
        for position, pair, _, _ in occurrences(prompt):
            vector = features(prompt, position, history, population)
            prediction = next(predictions)
            folded = artifact["intercept"] + sum(
                a * b for a, b in zip(vector, artifact["coefficients"])
            )
            if not math.isclose(prediction, folded, rel_tol=1e-12, abs_tol=1e-12):
                raise ValueError("Folded export differs from fitted estimator")
            pair_count, pair_sum = totals.pairs.get(pair, PairTotals())
            base = baseline_log_ms(
                {"user": totals.mean(population), "pairSum": pair_sum, "pairCount": pair_count},
                population,
                baseline["kind"],
                baseline["k"],
            )
            rows.append(
                {
                    "position": position,
                    "pair": pair,
                    "features": vector,
                    "predictedLogMs": prediction,
                    "predictedMs": math.exp(prediction),
                    "baselineLogMs": base,
                }
            )
        cases.append({"prompt": prompt, "history": _history_json(totals), "occurrences": rows})

    prompt = "cat cat"
    stream = [
        {
            "LETTER": char,
            "KEYCODE": str(32 if char == " " else ord(char.upper())),
            "PRESS_TIME": str(timestamp),
        }
        for char, timestamp in zip(prompt, [0, 100, 300, 400, 500, 550, 650])
    ]
    retained = observations(prompt, stream)
    transition = {
        "prompt": prompt,
        "events": stream,
        "eligibleOccurrences": retained,
        "historyAfter": _history_json(summary_history([retained])),
    }
    return {
        "synthetic": True,
        "modelVersion": artifact["modelVersion"],
        "cases": cases,
        "transitionFixture": transition,
    }
