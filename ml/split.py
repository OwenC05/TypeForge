"""Independent participant and normalized-prompt partitions for the frozen experiment."""

from collections.abc import Iterable
from typing import Literal

from .config import SEED, digest

type Split = Literal["train", "validation", "test"]
SPLITS: tuple[Split, ...] = ("train", "validation", "test")


def fingerprint(prompt: str) -> str:
    """Hash the lowercased prompt after collapsing whitespace to single spaces."""
    return digest(" ".join(prompt.lower().split()).encode())


def reserved(prompt: str) -> bool:
    """Reserve prompts whose first eight hash digits modulo five are zero."""
    return int(fingerprint(prompt)[:8], 16) % 5 == 0


def partition_participants(ids: Iterable[str], seed: int = SEED) -> dict[str, Split]:
    """Assign acquired IDs by seeded hash rank, cutting at floor(70%) and floor(85%)."""
    ordered = sorted(ids, key=lambda pid: digest(f"{seed}:split:{pid}".encode()))
    train_end = int(len(ordered) * 0.7)
    validation_end = int(len(ordered) * 0.85)
    result: dict[str, Split] = dict.fromkeys(ordered[:train_end], "train")
    result.update(dict.fromkeys(ordered[train_end:validation_end], "validation"))
    result.update(dict.fromkeys(ordered[validation_end:], "test"))
    return result
