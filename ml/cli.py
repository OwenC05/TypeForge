"""Deterministic public-data experiment; synthetic fixtures are tests only."""

import argparse
import time
from collections.abc import Sequence
from pathlib import Path

from .acquire import acquire
from .config import (
    MAX_BYTES,
    PARTICIPANTS,
    SEED,
    SOURCE,
    data_directory,
    read_json,
    write_json,
)
from .dataset import audit
from .export import export
from .train import train


def main(argv: Sequence[str] | None = None) -> None:
    """Run exactly one requested stage and record successful elapsed time in seconds."""
    directory = argparse.ArgumentParser(add_help=False)
    directory.add_argument(
        "--data-dir",
        type=Path,
        default=argparse.SUPPRESS,
        help="data directory (overrides TYPEFORGE_DATA_DIR and package default)",
    )
    # Suppressed defaults let either position work without erasing an earlier override.
    parser = argparse.ArgumentParser(description=__doc__, parents=[directory])
    stages = parser.add_subparsers(dest="command", required=True)
    acquisition = stages.add_parser("acquire", parents=[directory])
    acquisition.add_argument("--participants", type=int, default=PARTICIPANTS)
    acquisition.add_argument("--seed", type=int, default=SEED)
    acquisition.add_argument("--max-bytes", type=int, default=MAX_BYTES)
    acquisition.add_argument("--source", default=SOURCE)
    for command in ("audit", "train", "export"):
        stages.add_parser(command, parents=[directory])
    evaluation = stages.add_parser("evaluate", parents=[directory])
    evaluation.add_argument("--split", choices=["test"], required=True)
    args = parser.parse_args(argv)
    data_dir = data_directory(getattr(args, "data_dir", None))
    start = time.monotonic()
    if args.command == "acquire":
        acquire(
            data_dir,
            participants=args.participants,
            seed=args.seed,
            max_bytes=args.max_bytes,
            source=args.source,
        )
    elif args.command == "audit":
        audit(data_dir)
    elif args.command == "train":
        train(data_dir)
    elif args.command == "evaluate":
        from .evaluate import evaluate

        evaluate(data_dir)
    else:
        export(data_dir)
    duration = time.monotonic() - start
    timings_path = data_dir / "timings.json"
    timings = read_json(timings_path) if timings_path.exists() else {}
    timings[args.command] = round(duration, 3)
    write_json(timings_path, timings)
    print(f"{args.command} completed in {duration:.1f}s", flush=True)
