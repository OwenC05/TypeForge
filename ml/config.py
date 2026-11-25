"""Paths, frozen v1 settings and the two JSON encodings used by the experiment."""

import hashlib
import json
import os
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
DEFAULT_DATA_DIR = ROOT / "data"
GENERATED = ROOT.parent / "typing-app/client/src/generated"
REGISTRATION = ROOT / "experiment.json"
PARITY = ROOT / "fixtures/parity.json"

SOURCE = "https://userinterfaces.aalto.fi/136Mkeystrokes/data/Keystrokes.zip"
PARTICIPANTS = 2000
SEED = 42
MAX_BYTES = 268435456
MAX_INTERVAL_MS = 5000
HISTORY_SENTENCES = 10
ALPHAS = (0.1, 1, 10, 100)
SMOOTHING = (1, 5, 20)
BOOTSTRAP_REPLICATES = 2000


def data_directory(override: Path | None = None) -> Path:
    """Resolve the CLI override, then TYPEFORGE_DATA_DIR, then the package default."""
    if override is not None:
        return override
    return Path(os.environ.get("TYPEFORGE_DATA_DIR", DEFAULT_DATA_DIR))


def digest(value: object) -> str:
    """Hash raw bytes verbatim or JSON as compact UTF-8 with recursively sorted keys."""
    raw = (
        value
        if isinstance(value, bytes)
        else json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    )
    return hashlib.sha256(raw).hexdigest()


def read_json(path: Path) -> Any:
    """Read a UTF-8 JSON artifact, preserving its numeric types."""
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: object) -> None:
    """Atomically replace one artifact with sorted, indented JSON and a final newline."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(
        json.dumps(value, sort_keys=True, indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )
    temp.replace(path)
