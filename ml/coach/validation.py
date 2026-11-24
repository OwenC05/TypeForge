"""Replay the three fixed B3 development files and emit aggregate validation results."""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np

from ml.features import NAMES, PAIR_NAMES
from .model import FAST_CUT, PAIRS, Model, fit, fit_speed, training_cells
from .replay import Intervals, replay_person, summarize

ROOT = Path(__file__).resolve().parents[2]
CORPUS = ROOT / "ml/corpus/pair_frequencies.json"
RIDGE = ROOT / "typing-app/client/src/generated/model.json"
DATA_FILES = ("train.npz", "validation.npz", "validation-corrected.npz")


def file_hash(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def text_hash(path):
    return hashlib.sha256(path.read_bytes().replace(b"\r\n", b"\n")).hexdigest()


def coach_inputs():
    table = json.loads(CORPUS.read_bytes())
    bank = set(table["candidate_pairs"])
    frequency = np.array([
        1000 * table["pairs"][name[5:]]["per_character"] if name[5:] in bank else 0.0
        for name in PAIR_NAMES
    ])
    artifact = json.loads(RIDGE.read_bytes())
    if artifact["featureNames"] != NAMES or len(artifact["coefficients"]) != len(NAMES):
        raise ValueError("Frozen Ridge feature contract changed")
    ridge = (np.array(artifact["coefficients"]), artifact["intercept"],
             artifact["populationMeanLogMs"])
    return ridge, frequency


def fit_training(path):
    with np.load(path, allow_pickle=False) as data:
        wpm = data["typist_avg_wpm_15"]
        blocks = training_cells(data["interval_typist"], data["interval_pair"],
                                data["interval_log_ms"], len(wpm))
        eligible = data["typist_trials_eligible"]
    model = fit(blocks, len(wpm))
    below = wpm < FAST_CUT
    restricted_blocks = []
    for c in blocks:
        keep = below[c.who]
        restricted_blocks.append(c if keep.all() else c.select(keep))
    speed, _ = fit_speed(restricted_blocks, len(wpm))
    limited = Model(speed, model.tau2, model.sigma2)
    frozen = np.concatenate(([model.speed.center, model.speed.low, model.speed.high],
                             model.speed.population_pair, model.speed.a, model.speed.b,
                             model.tau2, model.sigma2)).astype("<f8")
    stats = {
        "assigned": len(wpm), "with_clean_sentence": int((eligible > 0).sum()),
        "clean_sentences": int(eligible.sum()), "maximum_assigned_wpm": float(np.nanmax(wpm)),
        "assigned_at_or_above_cut": int((wpm >= FAST_CUT).sum()),
        "center_low_high_log_ms": [model.speed.center, model.speed.low, model.speed.high],
        "cut_center_low_high_log_ms": [speed.center, speed.low, speed.high],
        "model_sha256": hashlib.sha256(frozen.tobytes()).hexdigest(),
    }
    return model, limited, stats


def grouped_intervals(data, edges, reasons, wanted_reason):
    who = data["interval_typist"]
    rows = Intervals(*(data["interval_" + name] for name in
                       ("trial_order", "pair", "log_ms", "position")))
    if any(len(column) != len(who) for column in (rows.order, rows.pair, rows.y, rows.position)):
        raise ValueError("Misaligned interval columns")
    if len(who) and ((who[1:] < who[:-1]).any() or who[-1] >= len(edges) - 1):
        raise ValueError("Invalid or unordered interval owners")
    if (rows.order >= np.diff(edges)[who]).any() or not np.isfinite(rows.y).all():
        raise ValueError("Invalid interval trial or log-ms value")
    if (rows.pair >= PAIRS).any() or (reasons[edges[who] + rows.order] != wanted_reason).any():
        raise ValueError("Interval pair or trial reason disagrees with its stream")
    return rows, np.searchsorted(who, np.arange(len(edges)))


def score_split(model, limited, ridge, frequency, data, corrected=None):
    wpm = data["typist_avg_wpm_15"]
    assigned = np.arange(len(wpm))
    if not np.array_equal(data["typist_index"], assigned):
        raise ValueError("Typist roster must include every assigned index in order")
    counts = data["typist_trials_replayed"].astype(np.int64)
    edges = np.r_[0, np.cumsum(counts)]
    who = data["trial_typist"]
    if not np.array_equal(who, np.repeat(assigned, counts)):
        raise ValueError("Trial owners disagree with the roster")
    if not np.array_equal(data["trial_order"], np.arange(len(who)) - edges[who]):
        raise ValueError("Trials must have contiguous chronological indices per typist")
    reasons = data["trial_reason"]
    labels = list(data["reason_labels"])
    clean_code = labels.index("")
    corrected_code = labels.index("clean-copy-required") if "clean-copy-required" in labels else -1
    clean, ce = grouped_intervals(data, edges, reasons, clean_code)
    extra_group = None
    if corrected is not None:
        extra_group = grouped_intervals(corrected, edges, reasons, corrected_code)
    sentence = data["trial_sentence"]
    texts = data["sentences"]
    rows = []
    for u, speed_band_value in enumerate(wpm):
        start, stop = edges[u:u + 2]
        # The frozen Ridge gets only prompts that were known when coaching would occur.
        prompts = texts[sentence[start:start + (stop - start) // 2]]
        extra = None
        if extra_group is not None:
            stream, bounds = extra_group
            extra = stream.take(slice(bounds[u], bounds[u + 1]))
        rows.append(replay_person(
            model, limited, ridge, frequency, clean.take(slice(ce[u], ce[u + 1])),
            extra, reasons[start:stop] == clean_code, prompts, speed_band_value,
        ))
    return summarize(rows, wpm, corrected is not None)


def validate(directory, expected_meta_hash):
    meta_path = directory / "meta.json"
    if file_hash(meta_path) != expected_meta_hash:
        raise ValueError("B3 development metadata SHA256 mismatch")
    meta = json.loads(meta_path.read_bytes())
    for name in DATA_FILES:
        if file_hash(directory / name) != meta["files"][name]:
            raise ValueError(f"B3 data SHA256 mismatch for {name}")
    ridge, frequency = coach_inputs()
    model, limited, training = fit_training(directory / DATA_FILES[0])
    with (np.load(directory / DATA_FILES[1], allow_pickle=False) as data,
          np.load(directory / DATA_FILES[2], allow_pickle=False) as corrected):
        results = score_split(model, limited, ridge, frequency, data, corrected)
    return {
        "input_sha256": {**{name: meta["files"][name] for name in DATA_FILES},
                         "meta.json": expected_meta_hash,
                         "pair_frequencies.json_LF": text_hash(CORPUS),
                         "model.json_LF": text_hash(RIDGE)},
        "training": training, **results,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path, help="B3's dataset-v2 development directory")
    parser.add_argument("meta_sha256", help="SHA256 of B3's verified meta.json")
    parser.add_argument("output", type=Path, help="Aggregate validation JSON")
    args = parser.parse_args()
    result = validate(args.directory, args.meta_sha256)
    args.output.write_text(json.dumps(result, allow_nan=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
